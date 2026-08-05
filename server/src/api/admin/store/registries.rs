//! The registry list: one pinned official catalog plus any the operator added.
//!
//! Official is always first and always wins an id clash, so a third-party
//! registry cannot shadow an official module with its own build. Everything a
//! registry offers is still gated at install time by the https + published
//! sha256 checks in [`super::install`] — a registry is a *list*, not a trust
//! grant.

use std::collections::HashSet;

use kroma_module_supervisor::Supervisor;
use serde::Deserialize;
use serde_json::{json, Value};

use super::catalog::{self, CatalogModule};
use crate::state::SharedState;

/// Operator input is bounded before it is fetched from: an admin can save this
/// list, and each entry becomes an outbound request at catalog time.
const MAX_EXTRA_REGISTRIES: usize = 16;
const MAX_NAME_LEN: usize = 64;
const MAX_URL_LEN: usize = 512;

pub const OFFICIAL_NAME: &str = "Official";

pub struct Registry {
    pub name: String,
    pub url: String,
    pub official: bool,
}

/// One registry's fetch outcome. A failure is per-registry: the others still
/// produce a catalog, so one unreachable host cannot blank the Store.
pub struct Fetched {
    pub registry: Registry,
    pub modules: Vec<CatalogModule>,
    pub error: Option<String>,
    /// Ids dropped because a higher-precedence registry already declared them.
    pub shadowed: Vec<String>,
}

#[derive(Deserialize)]
pub struct StoredRegistry {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub url: String,
    #[serde(default = "enabled_default")]
    pub enabled: bool,
}

fn enabled_default() -> bool {
    true
}

/// The list exactly as saved, including disabled and malformed entries. The
/// admin editor needs all of them; only [`configured`] is actually fetched.
pub fn stored(state: &SharedState) -> Vec<StoredRegistry> {
    serde_json::from_value(state.settings.get("moduleRegistries")).unwrap_or_default()
}

/// The official slot. `moduleRegistryUrl` overrides WHERE the official catalog
/// lives (unchanged from when it was the only registry), so an operator who
/// pointed the Store at their own catalog keeps exactly that catalog rather
/// than silently gaining the built-in one back underneath their own.
fn official(state: &SharedState) -> Registry {
    Registry { name: OFFICIAL_NAME.to_string(), url: catalog::registry_url(state), official: true }
}

/// Every registry to consult, official first. Disabled and malformed entries
/// are dropped; duplicates of an already-listed URL are dropped so one host is
/// never fetched (or counted) twice.
pub fn configured(state: &SharedState) -> Vec<Registry> {
    with_extras(official(state), stored(state))
}

/// Official first, then the acceptable extras. Split out from [`configured`] so
/// the filtering is testable without a live server.
///
/// An extra must be **https**: its catalog names the artifact URL and the
/// checksum to verify it against, so a catalog fetched over cleartext hands a
/// MITM both halves and the checksum guarantee is worth nothing. (The official
/// slot keeps its long-standing tolerance for any scheme — it is a single
/// deliberate override, and the test harness points it at a loopback server.)
fn with_extras(official: Registry, stored: Vec<StoredRegistry>) -> Vec<Registry> {
    let mut seen: HashSet<String> = [official.url.clone()].into_iter().collect();
    let mut out = vec![official];
    for entry in stored {
        if !entry.enabled {
            continue;
        }
        let url = entry.url.trim();
        if !url.starts_with("https://") || url.len() > MAX_URL_LEN {
            continue;
        }
        if !seen.insert(url.to_string()) {
            continue;
        }
        let name: String = entry.name.trim().chars().take(MAX_NAME_LEN).collect();
        let name = if name.is_empty() { url.to_string() } else { name };
        out.push(Registry { name, url: url.to_string(), official: false });
        // `out` carries the official entry too, hence the +1.
        if out.len() >= MAX_EXTRA_REGISTRIES + 1 {
            break;
        }
    }
    out
}

/// Fetch every configured registry and resolve id clashes in precedence order
/// (official first, then configured order). Sequential: the list is short and
/// each fetch is bounded by the supervisor's catalog timeout, so this costs a
/// round trip per registry rather than an unbounded stall.
pub async fn fetch_all(state: &SharedState, sup: &Supervisor) -> Vec<Fetched> {
    let mut claimed: HashSet<String> = HashSet::new();
    let mut out = Vec::new();
    for registry in configured(state) {
        let (mut modules, error) = match catalog::fetch(sup, &registry.url).await {
            Ok(modules) => (modules, None),
            Err(e) => (Vec::new(), Some(format!("{e:#}"))),
        };
        let mut shadowed = Vec::new();
        modules.retain(|m| {
            if claimed.insert(m.id.clone()) {
                return true;
            }
            shadowed.push(m.id.clone());
            false
        });
        out.push(Fetched { registry, modules, error, shadowed });
    }
    out
}

/// The merged catalog alone — what install/update resolution reads.
pub async fn fetch_merged(state: &SharedState, sup: &Supervisor) -> Vec<CatalogModule> {
    fetch_all(state, sup).await.into_iter().flat_map(|f| f.modules).collect()
}

/// Every registry row the admin editor shows: the official one, then the stored
/// list verbatim — disabled and malformed entries included, so the editor can
/// display and fix them — each merged with its fetch outcome when it had one.
pub fn status(state: &SharedState, fetched: &[Fetched]) -> Value {
    let outcome = |url: &str| fetched.iter().find(|f| f.registry.url == url);
    let row = |name: &str, url: &str, official: bool, enabled: bool| {
        let f = outcome(url);
        json!({
            "name": name,
            "url": url,
            "official": official,
            "enabled": enabled,
            "error": f.and_then(|f| f.error.clone()),
            "moduleCount": f.map(|f| f.modules.len()).unwrap_or(0),
            "shadowed": f.map(|f| f.shadowed.clone()).unwrap_or_default(),
        })
    };
    let official_url = catalog::registry_url(state);
    let mut rows = vec![row(OFFICIAL_NAME, &official_url, true, true)];
    for entry in stored(state) {
        let url = entry.url.trim();
        let name = entry.name.trim();
        let name = if name.is_empty() { url } else { name };
        rows.push(row(name, url, false, entry.enabled));
    }
    Value::Array(rows)
}

/// Which registry each id came from, so a card can show its source.
pub fn sources(fetched: &[Fetched]) -> std::collections::HashMap<String, String> {
    fetched
        .iter()
        .flat_map(|f| f.modules.iter().map(|m| (m.id.clone(), f.registry.name.clone())))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reg(name: &str, url: &str, official: bool) -> Registry {
        Registry { name: name.into(), url: url.into(), official }
    }

    fn module(id: &str, version: &str) -> CatalogModule {
        CatalogModule {
            id: id.into(),
            name: id.into(),
            version: version.into(),
            description: String::new(),
            min_server: None,
            library: false,
            icon: None,
            depends_on: Vec::new(),
            artifacts: Vec::new(),
        }
    }

    // The merge step of `fetch_all`, over already-fetched results.
    fn merge(input: Vec<(Registry, Vec<CatalogModule>)>) -> Vec<Fetched> {
        let mut claimed: HashSet<String> = HashSet::new();
        input
            .into_iter()
            .map(|(registry, mut modules)| {
                let mut shadowed = Vec::new();
                modules.retain(|m| {
                    if claimed.insert(m.id.clone()) {
                        return true;
                    }
                    shadowed.push(m.id.clone());
                    false
                });
                Fetched { registry, modules, error: None, shadowed }
            })
            .collect()
    }

    #[test]
    fn official_wins_an_id_declared_by_a_later_registry() {
        let merged = merge(vec![
            (reg(OFFICIAL_NAME, "https://o", true), vec![module("tv.kroma.a", "1.0.0")]),
            (
                reg("Third party", "https://x", false),
                // A higher version does NOT let a third party take the id over.
                vec![module("tv.kroma.a", "9.9.9"), module("tv.x.b", "0.1.0")],
            ),
        ]);
        assert_eq!(merged[0].modules.len(), 1);
        assert_eq!(merged[0].modules[0].version, "1.0.0");
        assert_eq!(merged[1].shadowed, vec!["tv.kroma.a"]);
        assert_eq!(merged[1].modules.len(), 1);
        assert_eq!(merged[1].modules[0].id, "tv.x.b");
    }

    fn stored_entry(name: &str, url: &str, enabled: bool) -> StoredRegistry {
        StoredRegistry { name: name.into(), url: url.into(), enabled }
    }

    #[test]
    fn extras_are_filtered_to_enabled_https_and_deduped() {
        let out = with_extras(
            reg(OFFICIAL_NAME, "https://official", true),
            vec![
                stored_entry("Cleartext", "http://insecure/modules.json", true),
                stored_entry("Disabled", "https://off/modules.json", false),
                stored_entry("Good", " https://good/modules.json ", true),
                stored_entry("Dupe", "https://good/modules.json", true),
                stored_entry("Same as official", "https://official", true),
                stored_entry("", "https://unnamed/modules.json", true),
            ],
        );
        let names: Vec<&str> = out.iter().map(|r| r.name.as_str()).collect();
        assert_eq!(names, vec![OFFICIAL_NAME, "Good", "https://unnamed/modules.json"]);
        // Trimmed, and official keeps precedence by staying first.
        assert_eq!(out[1].url, "https://good/modules.json");
        assert!(out[0].official);
        assert!(!out[1].official);
    }

    #[test]
    fn the_extra_registry_count_is_capped() {
        let many = (0..MAX_EXTRA_REGISTRIES + 5)
            .map(|i| stored_entry("r", &format!("https://r{i}/modules.json"), true))
            .collect();
        let out = with_extras(reg(OFFICIAL_NAME, "https://official", true), many);
        assert_eq!(out.len(), MAX_EXTRA_REGISTRIES + 1);
    }

    #[test]
    fn earlier_third_party_shadows_a_later_one() {
        let merged = merge(vec![
            (reg(OFFICIAL_NAME, "https://o", true), vec![]),
            (reg("First", "https://a", false), vec![module("tv.x.b", "1.0.0")]),
            (reg("Second", "https://b", false), vec![module("tv.x.b", "2.0.0")]),
        ]);
        assert_eq!(merged[1].modules[0].version, "1.0.0");
        assert_eq!(merged[2].shadowed, vec!["tv.x.b"]);
    }
}
