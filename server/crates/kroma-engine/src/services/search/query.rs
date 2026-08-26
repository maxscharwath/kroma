//! Query construction.
//!
//! Each query token is matched across every weighted text field: exactly, by
//! prefix (so it matches while you're still typing or dictating), and, on the
//! fields that hold a name, fuzzily. The per-field matches are OR'd together;
//! the per-token clauses are AND'd, so every word must land somewhere "tom
//! hardy" only matches a title whose cast (or title) covers both words.

use tantivy::query::{BooleanQuery, BoostQuery, FuzzyTermQuery, Occur, Query};
use tantivy::schema::Field;
use tantivy::Term;

use super::schema::Fields;

// Field, weight, and whether a typo may be forgiven in it. A title hit outranks
// an alt-title/cast hit, which outranks a genre hit, which outranks a loose
// overview hit. `show_title` sits near the bottom on purpose: it is there so
// "breaking bad ozymandias" resolves to the episode, not so that every episode
// of a show competes with the show itself.
//
// Fuzziness belongs on the fields that hold a name, where the reader is
// reproducing one from memory. An overview is prose: at any useful edit
// distance a long synopsis matches most queries by accident, burying the title
// they actually typed.
fn weights(f: &Fields) -> [(Field, f32, bool); 6] {
    [
        (f.title, 6.0, true),
        (f.alt_title, 4.0, true),
        (f.show_title, 1.5, true),
        (f.cast, 3.0, true),
        (f.genres, 2.0, false),
        (f.overview, 1.0, false),
    ]
}

// Edit-distance budget for a token. A budget of 2 on a middling word is not typo
// tolerance, it is a different word: at 2, "arrival" reaches "arrive" and
// "rival", which appear in enough synopses to bury the film of that name. Only a
// long token, where two edits are a small fraction of it, gets the full budget.
// tantivy caps fuzzy distance at 2.
fn distance(token: &str) -> u8 {
    match token.chars().count() {
        0..=4 => 0,
        5..=8 => 1,
        _ => 2,
    }
}

// An exact hit is worth more than a forgiven one: without this a fuzzy match in
// a heavier field outscores the reader typing the title correctly.
const EXACT_BONUS: f32 = 1.5;
const PREFIX_PENALTY: f32 = 0.5;

/// Build a query from already-normalized tokens (lowercased + diacritic-folded
/// by the index analyzer). Returns `None` when there are no tokens, so the caller
/// returns an empty result set rather than matching everything.
pub(super) fn build(fields: &Fields, tokens: &[String]) -> Option<Box<dyn Query>> {
    if tokens.is_empty() {
        return None;
    }
    let weights = weights(fields);
    let mut per_token: Vec<(Occur, Box<dyn Query>)> = Vec::with_capacity(tokens.len());
    for token in tokens {
        let dist = distance(token);
        let mut variants: Vec<(Occur, Box<dyn Query>)> = Vec::with_capacity(weights.len() * 3);
        for (field, boost, fuzzy_ok) in weights {
            let term = Term::from_field_text(field, token);
            let exact: Box<dyn Query> = Box::new(FuzzyTermQuery::new(term.clone(), 0, true));
            variants.push((
                Occur::Should,
                Box::new(BoostQuery::new(exact, boost * EXACT_BONUS)),
            ));
            // Fuzzy match (transposition_cost_one = treat swaps as one edit).
            if fuzzy_ok && dist > 0 {
                let fuzzy: Box<dyn Query> = Box::new(FuzzyTermQuery::new(term.clone(), dist, true));
                variants.push((Occur::Should, Box::new(BoostQuery::new(fuzzy, boost))));
            }
            // Prefix match for partial words ("brea" → "Breaking").
            let prefix: Box<dyn Query> = Box::new(FuzzyTermQuery::new_prefix(term, 0, true));
            variants.push((
                Occur::Should,
                Box::new(BoostQuery::new(prefix, boost * PREFIX_PENALTY)),
            ));
        }
        per_token.push((Occur::Must, Box::new(BooleanQuery::new(variants))));
    }
    Some(Box::new(BooleanQuery::new(per_token)))
}
