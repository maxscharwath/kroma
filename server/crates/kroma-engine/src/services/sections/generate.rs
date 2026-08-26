//! LLM authorship of personalized home sections: turn a user's taste [`Cluster`]s
//! into a small set of catchy, localized section names + an English "vibe" query
//! the embedder resolves to real catalog items. Also the evolving natural-language
//! taste profile. Prompt building + response parsing live here (pure + tested);
//! the orchestration (iterate users, call the model, persist) is the
//! `sections.personalize` job in [`crate::services::jobs`].

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::db::{self, Pool};

use super::taste::Cluster;

// How many sections we ask the model for (and cap to).
const MAX_SECTIONS: usize = 6;
// TMDB's English genre vocabulary, closed on purpose: the model picks from it
// and the same strings are matched against the English catalogue, so a row can
// be held to what it promised without a synonym table in between.
const TMDB_GENRES: &[&str] = &[
    "Action",
    "Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Fantasy",
    "History",
    "Horror",
    "Music",
    "Mystery",
    "Romance",
    "Science Fiction",
    "Thriller",
    "War",
    "Western",
];

/// TMDB's name for `raw`, or `None` when it names no genre TMDB has.
///
/// Matched loosely on purpose: a model writes "sci-fi", "Sci Fi" and "comedy"
/// for genres the catalogue spells "Science Fiction" and "Comedy", and a
/// silently dropped name leaves a row with nothing to be held to.
fn canonical_genre(raw: &str) -> Option<String> {
    let key: String = raw
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect();
    if key.is_empty() {
        return None;
    }
    let alias = match key.as_str() {
        "scifi" | "sciencefiction" | "sf" => "Science Fiction",
        "kids" | "children" => "Family",
        "docu" | "documentaries" => "Documentary",
        "animated" | "anime" => "Animation",
        "thrillers" | "suspense" => "Thriller",
        "horrors" | "scary" => "Horror",
        "comedies" | "funny" => "Comedy",
        "dramas" => "Drama",
        "adventures" => "Adventure",
        _ => "",
    };
    if !alias.is_empty() {
        return Some(alias.to_string());
    }
    TMDB_GENRES
        .iter()
        .find(|g| {
            g.to_lowercase()
                .chars()
                .filter(|c| c.is_alphanumeric())
                .collect::<String>()
                == key
        })
        .map(|g| (*g).to_string())
}

// Cap on a single section title, defended on parse (catchy, not an essay). A
// real home-screen row runs longer than it looks: "Films parfaits pour un
// moment de grand divertissement" is 52 characters, and 48 cut it mid-word.
const MAX_TITLE: usize = 64;

/// A row's name, written by the model in every language the server serves.
///
/// Also reads a bare string, which is what rows cached before the model was
/// asked for more than one language hold: those keep working, in the single
/// language they were written in, instead of vanishing from the home screen.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Localized {
    Single(String),
    ByLang(HashMap<String, String>),
}

impl Default for Localized {
    fn default() -> Self {
        Self::Single(String::new())
    }
}

impl Localized {
    /// The reader's language, else the default one, else whatever there is.
    pub fn get(&self, locale: &str) -> &str {
        match self {
            Self::Single(s) => s,
            Self::ByLang(by) => by
                .get(locale)
                .or_else(|| by.get(crate::i18n::DEFAULT_LOCALE))
                .or_else(|| by.values().next())
                .map(String::as_str)
                .unwrap_or_default(),
        }
    }

    fn is_blank(&self) -> bool {
        match self {
            Self::Single(s) => s.trim().is_empty(),
            Self::ByLang(by) => by.values().all(|v| v.trim().is_empty()),
        }
    }

    fn trimmed_and_capped(self) -> Self {
        let cap = |s: String| -> String { s.trim().chars().take(MAX_TITLE).collect() };
        match self {
            Self::Single(s) => Self::Single(cap(s)),
            Self::ByLang(by) => Self::ByLang(by.into_iter().map(|(k, v)| (k, cap(v))).collect()),
        }
    }
}

/// A personalized section authored by the LLM and cached per user. `query` is the
/// embedding search phrase (English vibe); `title`/`reason` carry every language.
/// Stored as a JSON array in `user_taste.sections`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenSection {
    pub key: String,
    pub title: Localized,
    pub query: String,
    #[serde(default)]
    pub reason: Localized,
    /// TMDB's English genre names for what the row promises. The nearest-vector
    /// search alone put Gladiator II under a horror heading; this is what keeps
    /// a row's contents to what its name said they would be.
    #[serde(default)]
    pub genres: Vec<String>,
    /// `movies`, `shows`, or anything else for both. A row headed "Series" that
    /// opens on films is as wrong as one headed horror that opens on a comedy.
    #[serde(default)]
    pub form: String,
}

/// Load a user's cached personalized sections (empty if none / malformed).
pub fn load(pool: &Pool, user_id: &str) -> Vec<GenSection> {
    let Ok(Some((_, json))) = db::get_user_taste(pool, user_id) else {
        return Vec::new();
    };
    serde_json::from_str(&json).unwrap_or_default()
}

/// Build the (system, user) prompt for one user's clusters. `locale` is the
/// account's UI language code (`"fr"`/`"en"`); `prev_profile` is last run's
/// profile, if any, so the model refines rather than restarts.
pub fn build_prompt(
    locale: &str,
    prev_profile: Option<&str>,
    clusters: &[Cluster],
) -> (String, String) {
    let lang = language_name(locale);
    // Every language the server serves, asked for in one call: a row named in
    // one language is a French heading over an English library for everyone
    // else in the household, and a second call per language would pay the model
    // again to think the same thought.
    let langs = crate::i18n::SUPPORTED_LOCALES
        .iter()
        .map(|l| format!("\"{l}\" ({})", language_name(l)))
        .collect::<Vec<_>>()
        .join(", ");
    let genres = TMDB_GENRES.join(", ");
    let shape = crate::i18n::SUPPORTED_LOCALES
        .iter()
        .map(|l| format!("\"{l}\": string"))
        .collect::<Vec<_>>()
        .join(", ");
    let system = format!(
        "You are the personalization curator for a home-media library. From a viewer's \
         taste groups you write a short taste profile and name a few personalized rows for \
         their home screen.\n\
         Reply with STRICT JSON only no prose, no markdown, no code fences shaped exactly:\n\
         {{\"profile\": string, \"sections\": [{{\"title\": {{{shape}}}, \"query\": string, \"genres\": [string], \"form\": string, \"reason\": {{{shape}}}}}]}}\n\
         Rules:\n\
         - Write \"profile\" (2-3 sentences) in {lang}.\n\
         - \"title\" and \"reason\" are objects carrying that text in EVERY one of \
         these languages: {langs}.\n\
         - A \"title\" is a home-screen row name: a PLURAL noun for what is on the \
         shelf, qualified by an adjective or by a short phrase naming the mood or the \
         occasion. Two to eight words, playful, idiomatic.\n\
         - NEVER name a row by listing the group's genres: \"Drama and Adventure\" is \
         a genre list, not a row name. The genres tell you what the group IS, never \
         what to call it. No two genres joined by \"and\" or \"et\", no naming of the \
         audience (Fans, Lovers, Enthusiasts), never singular.\n\
         - Those are patterns, not a menu: every title you return must be your own \
         wording, invented for THESE groups. Reusing an example verbatim is a failure.\n\
         - \"form\": \"movies\" if the row is films, \"shows\" if it is series, \
         \"both\" if it is either. The row is filtered to it, so name the form \
         the title claims: a title saying Series with a form of movies is a lie the \
         reader sees.\n\
         - \"reason\": one short clause ('because you …').\n\
         - \"query\": an ENGLISH phrase (5-12 words) describing the vibe/genre/mood, used to \
         search the library by meaning. Do NOT put specific movie titles in \"query\".\n\
         - Give between 3 and {MAX_SECTIONS} distinct sections covering the groups below."
    );

    let mut user = String::new();
    if let Some(p) = prev_profile.filter(|p| !p.trim().is_empty()) {
        user.push_str(&format!("Previous taste profile (refine it): {p}\n\n"));
    }
    user.push_str("Taste groups (from what they've watched):\n");
    for (i, c) in clusters.iter().enumerate() {
        user.push_str(&format!(
            "Group {}: examples = [{}]; genres = [{}]; keywords = [{}]\n",
            i + 1,
            c.titles.join(", "),
            c.genres.join(", "),
            c.keywords.join(", "),
        ));
    }
    user.push_str("\nReturn the JSON now.");
    (system, user)
}

#[derive(Deserialize)]
struct LlmOut {
    #[serde(default)]
    profile: String,
    #[serde(default)]
    sections: Vec<LlmSection>,
}

#[derive(Deserialize)]
struct LlmSection {
    #[serde(default)]
    title: Localized,
    #[serde(default)]
    query: String,
    #[serde(default)]
    reason: Localized,
    #[serde(default)]
    genres: Vec<String>,
    #[serde(default)]
    form: String,
}

/// Parse a model reply into `(profile, sections)`. Tolerant of code fences and
/// surrounding prose: extracts the outermost `{…}` and validates each section.
pub fn parse_response(text: &str) -> anyhow::Result<(String, Vec<GenSection>)> {
    let json = extract_json(text).ok_or_else(|| anyhow::anyhow!("no JSON object in reply"))?;
    let out: LlmOut = serde_json::from_str(json)?;

    let mut sections = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut named = std::collections::HashSet::new();
    for s in out.sections {
        let query = s.query.trim();
        if s.title.is_blank() || query.is_empty() {
            continue;
        }
        let title = s.title.trimmed_and_capped();
        // Keyed off the query, which is English whatever the reader speaks: a
        // key cut from the title would change with the language it happened to
        // be read in, and the same row would count as two.
        let mut key = slug(query);
        if key.is_empty() {
            key = format!("s{}", sections.len() + 1);
        }
        // Two rows are the same row if they search for the same thing OR if
        // they would print the same heading, whatever their queries were. A
        // heading made only of punctuation slugs to nothing and is no evidence
        // of anything, so it is not compared.
        let heading = slug(title.get(crate::i18n::DEFAULT_LOCALE));
        if !seen.insert(key.clone()) || (!heading.is_empty() && !named.insert(heading)) {
            continue;
        }
        sections.push(GenSection {
            key,
            title,
            query: query.to_string(),
            reason: s.reason.trimmed_and_capped(),
            genres: s.genres.iter().filter_map(|g| canonical_genre(g)).collect(),
            form: s.form.trim().to_lowercase(),
        });
        if sections.len() >= MAX_SECTIONS {
            break;
        }
    }
    Ok((out.profile.trim().to_string(), sections))
}

// Find the outermost JSON object in `text` (handles ```json fences / preamble).
fn extract_json(text: &str) -> Option<&str> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end > start {
        Some(&text[start..=end])
    } else {
        None
    }
}

/// ASCII slug for a section key (`"Neon Noir Nights"` → `"neon-noir-nights"`).
pub(crate) fn slug(s: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for c in s.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

fn language_name(locale: &str) -> &'static str {
    match locale {
        "en" => "English",
        _ => "French",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_clean_json() {
        let reply = r#"{"profile":"You love stylish crime.","sections":[
            {"title":"Neon Noir Nights","query":"neon-soaked night crime thriller","reason":"because you love stylish crime"},
            {"title":"Mind Benders","query":"surreal mind-bending science fiction","reason":"you enjoy puzzles"}
        ]}"#;
        let (profile, sections) = parse_response(reply).unwrap();
        assert_eq!(profile, "You love stylish crime.");
        assert_eq!(sections.len(), 2);
        assert_eq!(sections[0].key, "neon-soaked-night-crime-thriller");
        assert_eq!(sections[1].query, "surreal mind-bending science fiction");
    }

    #[test]
    fn a_row_is_named_in_every_language_the_server_serves() {
        let reply = r#"{"sections":[{
            "title":{"fr":"Science-Fiction Epique","en":"Epic Science Fiction"},
            "query":"epic space opera science fiction",
            "reason":{"fr":"parce que vous aimez","en":"because you like"}
        }]}"#;

        let (_, sections) = parse_response(reply).unwrap();

        assert_eq!(sections[0].title.get("fr"), "Science-Fiction Epique");
        assert_eq!(sections[0].title.get("en"), "Epic Science Fiction");
        assert_eq!(sections[0].reason.get("en"), "because you like");
    }

    #[test]
    fn a_row_cached_before_the_model_was_asked_for_more_than_one_language_still_reads() {
        let one: GenSection =
            serde_json::from_str(r#"{"key":"k","title":"Comedies Fantastiques","query":"q"}"#)
                .unwrap();

        // It only has the language it was written in, but a home screen missing
        // a row is worse than one row in the wrong language until it regenerates.
        assert_eq!(one.title.get("en"), "Comedies Fantastiques");
        assert_eq!(one.reason.get("en"), "");
    }

    #[test]
    fn an_unknown_language_falls_back_rather_than_printing_nothing() {
        let s: GenSection =
            serde_json::from_str(r#"{"key":"k","title":{"fr":"Titre","en":"Title"},"query":"q"}"#)
                .unwrap();

        assert_eq!(s.title.get("de"), s.title.get(crate::i18n::DEFAULT_LOCALE));
        assert!(!s.title.get("de").is_empty());
    }

    #[test]
    fn the_prompt_asks_for_every_supported_language() {
        let (system, _) = build_prompt("fr", None, &[]);

        for lang in crate::i18n::SUPPORTED_LOCALES {
            assert!(
                system.contains(&format!("\"{lang}\": string")),
                "the shape does not ask for {lang}: {system}"
            );
        }
    }

    #[test]
    fn a_genre_the_model_spelled_its_own_way_still_counts() {
        // Dropped silently, these leave the row with nothing to be held to, and
        // an unguarded row is what put Don't Breathe under Comedies.
        assert_eq!(
            canonical_genre("sci-fi").as_deref(),
            Some("Science Fiction")
        );
        assert_eq!(canonical_genre("Comedies").as_deref(), Some("Comedy"));
        assert_eq!(canonical_genre(" horror ").as_deref(), Some("Horror"));
        assert_eq!(
            canonical_genre("Science Fiction").as_deref(),
            Some("Science Fiction")
        );
        assert_eq!(canonical_genre("nonsense"), None);
    }

    #[test]
    fn tolerates_code_fences_and_prose() {
        let reply = "Sure! Here you go:\n```json\n{\"profile\":\"p\",\"sections\":[{\"title\":\"Cozy Classics\",\"query\":\"warm cozy classic comfort films\",\"reason\":\"r\"}]}\n```\nEnjoy!";
        let (_, sections) = parse_response(reply).unwrap();
        assert_eq!(sections.len(), 1);
        assert_eq!(sections[0].title.get("en"), "Cozy Classics");
    }

    #[test]
    fn drops_invalid_and_duplicate_sections() {
        let reply = r#"{"sections":[
            {"title":"","query":"q"},
            {"title":"Action","query":""},
            {"title":"Action Fix","query":"high octane action"},
            {"title":"Action Fix","query":"another action"}
        ]}"#;
        let (_, sections) = parse_response(reply).unwrap();
        assert_eq!(sections.len(), 1);
        assert_eq!(sections[0].key, "high-octane-action");
    }

    #[test]
    fn prompt_carries_groups_and_language() {
        let clusters = vec![Cluster {
            ids: vec!["1".into()],
            titles: vec!["Blade Runner".into()],
            genres: vec!["Science Fiction".into()],
            keywords: vec!["dystopia".into()],
        }];
        let (system, user) = build_prompt("en", Some("prev"), &clusters);
        assert!(system.contains("English"));
        assert!(user.contains("Blade Runner"));
        assert!(user.contains("Previous taste profile"));
    }

    #[test]
    fn build_prompt_omits_blank_previous_profile_and_uses_french() {
        let clusters = vec![Cluster {
            ids: vec![],
            titles: vec![],
            genres: vec![],
            keywords: vec![],
        }];
        let (system, user) = build_prompt("fr", Some("   "), &clusters);
        assert!(system.contains("French"));
        assert!(!user.contains("Previous taste profile")); // blank prev skipped
        let (_s, user2) = build_prompt("de", None, &clusters);
        assert!(!user2.contains("Previous taste profile"));
    }

    #[test]
    fn slug_handles_edges() {
        assert_eq!(slug("Neon Noir Nights"), "neon-noir-nights");
        assert_eq!(slug("  --Hello, World!! --"), "hello-world");
        assert_eq!(slug("café déjà"), "caf-d-j"); // non-ascii chars act as separators
        assert_eq!(slug("!!!"), "");
        assert_eq!(slug(""), "");
    }

    #[test]
    fn extract_json_finds_object_or_none() {
        assert_eq!(extract_json("prefix {\"a\":1} suffix"), Some("{\"a\":1}"));
        assert!(extract_json("no braces").is_none());
        assert!(extract_json("}before{").is_none()); // end <= start
    }

    #[test]
    fn language_name_maps_en_else_french() {
        assert_eq!(language_name("en"), "English");
        assert_eq!(language_name("fr"), "French");
        assert_eq!(language_name("xx"), "French");
    }

    #[test]
    fn parse_response_caps_at_max_sections() {
        let mut secs = String::new();
        for i in 0..10 {
            secs.push_str(&format!(
                "{{\"title\":\"Row {i}\",\"query\":\"vibe {i} words here\"}},"
            ));
        }
        let reply = format!("{{\"sections\":[{}]}}", secs.trim_end_matches(','));
        let (_, sections) = parse_response(&reply).unwrap();
        assert_eq!(sections.len(), MAX_SECTIONS);
    }

    #[test]
    fn parse_response_errors_without_json() {
        assert!(parse_response("no json here").is_err());
    }

    #[test]
    fn a_query_that_slugs_to_nothing_still_gets_a_stable_key() {
        let reply = r#"{"sections":[{"title":"Loud","query":"!!!"},
                                    {"title":"Quiet","query":"???"}]}"#;
        let (_, sections) = parse_response(reply).unwrap();
        assert_eq!(sections.len(), 2);
        assert_eq!(sections[0].key, "s1");
        assert_eq!(sections[1].key, "s2");
    }

    #[test]
    fn load_returns_empty_when_no_taste_row() {
        let pool = crate::db::testing::temp_pool("gen-load");
        assert!(load(&pool, "nobody").is_empty());
    }
}
