//! Locale overlay for served catalog entities.
//!
//! During the transition the `metadata` blob still carries the household
//! (primary) language; these helpers overlay the request locale's translation
//! on top so each user sees the catalog in *their* language. The overlay only
//! touches the localized text (title/tagline/overview/genres/character names)
//! the invariant art/ids/people already on the blob are left untouched. Applied
//! at the API boundary, right before serialization, keyed off `Accept-Language`.
//!
//! Resolution falls back requested lang -> `en` -> any (see
//! [`super::translations::resolve_many`]); an entity with no stored translation
//! keeps its blob text, so this is always safe to call.

use super::translations::{self, TransData};
use super::*;

use kroma_domain::{CastMember, Metadata, Season, Show};

mod items;
mod shows;

#[cfg(test)]
mod test_support;

pub use items::*;
pub use shows::*;

// Overlay one season's cast character names from its `season_cast` translation.
fn overlay_season_cast(
    conn: &Connection,
    show_id: &str,
    season: &mut Season,
    locale: &str,
) -> Result<()> {
    if season.cast.is_empty() {
        return Ok(());
    }
    let sc_id = format!("{show_id}:{}", season.number);
    if let Some(t) =
        translations::resolve_many(conn, "season_cast", &[sc_id.as_str()], locale)?.get(&sc_id)
    {
        apply_characters(&mut season.cast, &t.characters);
    }
    Ok(())
}

// The title in the requested locale, or `None` to keep whatever the caller has.
//
// Its own function because the entity's OWN `title` is what every list, card and
// hero renders; `metadata.title` is the enriched blob's copy, and a client that
// happens to read the first while the overlay only wrote the second shows the
// household language to a reader who asked for another. `splash_entries` has
// always overwritten the entity's title, and these overlays now agree with it.
fn localized_title(tr: &TransData) -> Option<String> {
    tr.title.clone().filter(|t| !t.trim().is_empty())
}

// Overlay the localized text fields onto an item's metadata (no-op when the item
// has no blob metadata yet, i.e. not enriched).
fn apply(meta: Option<&mut Metadata>, tr: &TransData) {
    let Some(meta) = meta else { return };
    if tr.title.is_some() {
        meta.title = tr.title.clone();
    }
    if tr.tagline.is_some() {
        meta.tagline = tr.tagline.clone();
    }
    if tr.overview.is_some() {
        meta.overview = tr.overview.clone();
    }
    if !tr.genres.is_empty() {
        meta.genres = tr.genres.clone();
    }
    apply_characters(&mut meta.cast, &tr.characters);
}

// A show's metadata overlay (same fields; shows carry no per-title cast here).
fn apply_item(item: &mut kroma_domain::MediaItem, tr: &TransData) {
    if let Some(title) = localized_title(tr) {
        item.title = title;
    }
    apply(item.metadata.as_mut(), tr);
}

fn apply_show(show: &mut Show, tr: &TransData) {
    if let Some(title) = localized_title(tr) {
        show.title = title;
    }
    apply(show.metadata.as_mut(), tr);
}

// Overlay localized character names onto a cast list, aligned by index (the
// translation was written in the same TMDB cast order the core was stored in).
fn apply_characters(cast: &mut [CastMember], characters: &[Option<String>]) {
    for (member, ch) in cast.iter_mut().zip(characters.iter()) {
        if ch.is_some() {
            member.character = ch.clone();
        }
    }
}
