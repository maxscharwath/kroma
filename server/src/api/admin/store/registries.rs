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

// Bounds on operator input: each accepted entry becomes an outbound request.
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
///
/// Parsed per element: one unreadable entry must not take the rest of the list
/// with it, or a single bad row would blank the editor and the next save would
/// then persist that truncation.
pub fn stored(state: &SharedState) -> Vec<StoredRegistry> {
    let Value::Array(entries) = state.settings.get("moduleRegistries") else {
        return Vec::new();
    };
    entries
        .into_iter()
        .map(|entry| {
            serde_json::from_value(entry).unwrap_or(StoredRegistry {
                name: String::new(),
                url: String::new(),
                enabled: false,
            })
        })
        .collect()
}

// `moduleRegistryUrl` says WHERE the official catalog lives, so an operator who
// pointed the Store at their own keeps exactly that one rather than gaining the
// built-in catalog back underneath it.
fn official(state: &SharedState) -> Registry {
    Registry { name: OFFICIAL_NAME.to_string(), url: catalog::registry_url(state), official: true }
}

/// One stored entry after normalization, with the reason it will not be
/// consulted when there is one. Every consumer reads this, so the editor can
/// never disagree with what was actually fetched.
pub struct Considered {
    pub name: String,
    pub url: String,
    pub enabled: bool,
    pub skipped: Option<&'static str>,
}

/// Every registry to consult, official first.
pub fn configured(state: &SharedState) -> Vec<Registry> {
    let official = official(state);
    let mut out = vec![Registry { name: official.name.clone(), url: official.url.clone(), official: true }];
    for entry in considered(&official.url, stored(state)) {
        if entry.skipped.is_none() {
            out.push(Registry { name: entry.name, url: entry.url, official: false });
        }
    }
    out
}

/// Normalize and vet each stored entry in order.
///
/// An extra must be https: its catalog names the artifact URL *and* the checksum
/// that vouches for it, so fetching it in cleartext hands an on-path attacker
/// both halves. The official slot keeps its tolerance for any scheme — it is one
/// deliberate override, and the test harness points it at a loopback server.
pub fn considered(official_url: &str, stored: Vec<StoredRegistry>) -> Vec<Considered> {
    let mut seen: HashSet<String> = [official_url.trim().to_string()].into_iter().collect();
    let mut accepted = 0usize;
    stored
        .into_iter()
        .map(|entry| {
            let url = entry.url.trim().to_string();
            let name: String = entry.name.trim().chars().take(MAX_NAME_LEN).collect();
            let name = if name.is_empty() { url.clone() } else { name };
            let skipped = if !entry.enabled {
                Some("disabled")
            } else if url.len() > MAX_URL_LEN {
                Some("URL is too long")
            } else if !url.starts_with("https://") {
                Some("not consulted: a registry URL must be https")
            } else if !seen.insert(url.clone()) {
                Some("not consulted: already listed")
            } else if accepted >= MAX_EXTRA_REGISTRIES {
                Some("not consulted: past the registry limit")
            } else {
                accepted += 1;
                None
            };
            Considered { name, url, enabled: entry.enabled, skipped }
        })
        .collect()
}

// `claimed` carries precedence across the walk: whoever inserts an id first
// keeps it.
fn merge_one(
    registry: Registry,
    mut modules: Vec<CatalogModule>,
    error: Option<String>,
    claimed: &mut HashSet<String>,
) -> Fetched {
    let mut shadowed = Vec::new();
    modules.retain(|m| {
        if claimed.insert(m.id.clone()) {
            return true;
        }
        shadowed.push(m.id.clone());
        false
    });
    Fetched { registry, modules, error, shadowed }
}

/// Fetch every configured registry and resolve id clashes in precedence order
/// (official first, then configured order). Sequential: the list is short and
/// each fetch is bounded by the supervisor's catalog timeout, so this costs a
/// round trip per registry rather than an unbounded stall.
pub async fn fetch_all(state: &SharedState, sup: &Supervisor) -> Vec<Fetched> {
    let mut claimed: HashSet<String> = HashSet::new();
    let mut out = Vec::new();
    for registry in configured(state) {
        let (modules, error) = match catalog::fetch(sup, &registry.url).await {
            Ok(modules) => (modules, None),
            Err(e) => (Vec::new(), Some(format!("{e:#}"))),
        };
        out.push(merge_one(registry, modules, error, &mut claimed));
    }
    out
}

/// The merged catalog for install and update resolution.
///
/// A failed OFFICIAL fetch is an error, not an empty list: official claims its
/// ids first, so treating an outage as "official offers nothing" would let a
/// third-party registry supply a first-party id — and auto-update would then
/// install it unattended. An extra registry failing is tolerated and logged.
pub async fn fetch_merged(state: &SharedState, sup: &Supervisor) -> anyhow::Result<Vec<CatalogModule>> {
    let fetched = fetch_all(state, sup).await;
    for f in &fetched {
        let Some(error) = &f.error else { continue };
        if f.registry.official {
            anyhow::bail!("registry {} is unreachable: {error}", f.registry.url);
        }
        tracing::warn!(registry = %f.registry.url, %error, "module registry unreachable; skipped");
    }
    Ok(fetched.into_iter().flat_map(|f| f.modules).collect())
}

/// Every registry row the admin editor shows: the official one, then the stored
/// list verbatim — disabled and malformed entries included, so the editor can
/// display and fix them — each merged with its fetch outcome when it had one.
pub fn status(state: &SharedState, fetched: &[Fetched]) -> Value {
    // Only a CONSULTED registry may claim a fetch outcome; matching on URL alone
    // would let a skipped duplicate borrow the stats of the row that won it.
    let row = |name: &str, url: &str, official: bool, enabled: bool, skipped: Option<&str>| {
        let f = skipped.is_none().then(|| fetched.iter().find(|f| f.registry.url == url)).flatten();
        json!({
            "name": name,
            "url": url,
            "official": official,
            "enabled": enabled,
            "skipped": skipped,
            "error": f.and_then(|f| f.error.clone()),
            "moduleCount": f.map(|f| f.modules.len()).unwrap_or(0),
            "shadowed": f.map(|f| f.shadowed.clone()).unwrap_or_default(),
        })
    };
    let official_url = catalog::registry_url(state);
    let mut rows = vec![row(OFFICIAL_NAME, &official_url, true, true, None)];
    for entry in considered(&official_url, stored(state)) {
        rows.push(row(&entry.name, &entry.url, false, entry.enabled, entry.skipped));
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

    // Drives `merge_one`, the same step `fetch_all` walks the registry list with.
    fn merge(input: Vec<(Registry, Vec<CatalogModule>)>) -> Vec<Fetched> {
        let mut claimed: HashSet<String> = HashSet::new();
        input
            .into_iter()
            .map(|(registry, modules)| merge_one(registry, modules, None, &mut claimed))
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
    fn every_rejected_entry_is_kept_with_the_reason_it_was_skipped() {
        let out = considered(
            "https://official",
            vec![
                stored_entry("Cleartext", "http://insecure/modules.json", true),
                stored_entry("Disabled", "https://off/modules.json", false),
                stored_entry("Good", " https://good/modules.json ", true),
                stored_entry("Dupe", "https://good/modules.json", true),
                stored_entry("Same as official", "https://official", true),
                stored_entry("", "https://unnamed/modules.json", true),
            ],
        );
        // Nothing is dropped: the editor must be able to show and fix each one.
        assert_eq!(out.len(), 6);
        let skipped: Vec<bool> = out.iter().map(|c| c.skipped.is_some()).collect();
        assert_eq!(skipped, vec![true, true, false, true, true, false]);
        assert_eq!(out[2].url, "https://good/modules.json", "url is trimmed");
        assert_eq!(out[5].name, "https://unnamed/modules.json", "empty name falls back to url");
    }

    #[test]
    fn the_extra_registry_count_is_capped() {
        let many = (0..MAX_EXTRA_REGISTRIES + 5)
            .map(|i| stored_entry("r", &format!("https://r{i}/modules.json"), true))
            .collect();
        let out = considered("https://official", many);
        assert_eq!(out.iter().filter(|c| c.skipped.is_none()).count(), MAX_EXTRA_REGISTRIES);
        assert_eq!(out.len(), MAX_EXTRA_REGISTRIES + 5, "over-cap entries are still listed");
    }

    #[test]
    fn a_long_name_is_truncated_once_for_both_the_fetch_and_the_editor() {
        let out = considered("https://official", vec![stored_entry(&"x".repeat(200), "https://a", true)]);
        assert_eq!(out[0].name.chars().count(), MAX_NAME_LEN);
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
