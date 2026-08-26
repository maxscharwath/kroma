//! Overlaying a locale onto items and home-section rows.

use super::{apply, apply_show};
use crate::translations::TransData;
use crate::{metadata_core, translations, Pool};
use anyhow::Result;

use kroma_domain::{Kind, MediaItem, SectionItem};

// The item's own `title` is the one the scan derived from the file, so it never
// changed language, and every card and hero renders it rather than the
// metadata's. Localizing one without the other is what leaves a French title
// over an English synopsis.
fn apply_item(item: &mut MediaItem, tr: &TransData) {
    apply(item.metadata.as_mut(), tr);
    if let Some(t) = &tr.title {
        item.title = t.clone();
    }
}

/// Overlay `locale` onto a batch of items (movies/videos + episodes). Episodes
/// resolve under the `'episode'` subject kind, everything else under `'item'`.
pub fn overlay_items(pool: &Pool, items: &mut [MediaItem], locale: &str) -> Result<()> {
    overlay_each(pool, items.iter_mut(), locale)
}

/// Overlay `locale` onto items reached through something other than a slice: a
/// resume row's inner item, the next episode, one `Option`. Every endpoint that
/// serves a [`MediaItem`] has to go through here, whatever it wraps it in, or
/// that one screen reads in the language the files were scanned in.
pub fn overlay_each<'a>(
    pool: &Pool,
    items: impl IntoIterator<Item = &'a mut MediaItem>,
    locale: &str,
) -> Result<()> {
    let mut items: Vec<&mut MediaItem> = items.into_iter().collect();
    if items.is_empty() {
        return Ok(());
    }
    let conn = pool.get()?;
    let movie_ids: Vec<&str> = items
        .iter()
        .filter(|i| i.kind != Kind::Episode)
        .map(|i| i.id.as_str())
        .collect();
    let ep_ids: Vec<&str> = items
        .iter()
        .filter(|i| i.kind == Kind::Episode)
        .map(|i| i.id.as_str())
        .collect();
    let movie_tr = translations::resolve_many(&conn, metadata_core::ITEM, &movie_ids, locale)?;
    let ep_tr = translations::resolve_many(&conn, "episode", &ep_ids, locale)?;
    for item in items.iter_mut() {
        let table = if item.kind == Kind::Episode {
            &ep_tr
        } else {
            &movie_tr
        };
        if let Some(tr) = table.get(&item.id) {
            apply_item(item, tr);
        }
    }
    Ok(())
}

/// Overlay `locale` onto home-section items (a mix of movies and shows).
pub fn overlay_section_items(pool: &Pool, items: &mut [SectionItem], locale: &str) -> Result<()> {
    if items.is_empty() {
        return Ok(());
    }
    let conn = pool.get()?;
    let movie_ids: Vec<&str> = items
        .iter()
        .filter_map(|s| match s {
            SectionItem::Movie { item } => Some(item.id.as_str()),
            SectionItem::Show { .. } => None,
        })
        .collect();
    let show_ids: Vec<&str> = items
        .iter()
        .filter_map(|s| match s {
            SectionItem::Show { show } => Some(show.id.as_str()),
            SectionItem::Movie { .. } => None,
        })
        .collect();
    let m_tr = translations::resolve_many(&conn, metadata_core::ITEM, &movie_ids, locale)?;
    let s_tr = translations::resolve_many(&conn, metadata_core::SHOW, &show_ids, locale)?;
    for it in items.iter_mut() {
        match it {
            SectionItem::Movie { item } => {
                if let Some(t) = m_tr.get(&item.id) {
                    apply_item(item, t);
                }
            }
            SectionItem::Show { show } => {
                if let Some(t) = s_tr.get(&show.id) {
                    apply_show(show, t);
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::localize::test_support::*;
    use crate::translations::TransData;

    #[test]
    fn the_items_own_title_is_localized_not_only_its_metadata() {
        let p = pool();
        translations::put(
            &p,
            metadata_core::ITEM,
            "m1",
            "en",
            translations::TMDB,
            &td("Minions: The Rise of Gru", vec![]),
        )
        .unwrap();

        let mut items = vec![item("m1", Kind::Movie)];
        overlay_items(&p, &mut items, "en").unwrap();

        // Every card and hero renders `title`, not `metadata.title`, so leaving
        // it as the scan's would show the filename's language whatever the
        // reader asked for.
        assert_eq!(items[0].title, "Minions: The Rise of Gru");
    }

    #[test]
    fn the_home_rows_localize_the_title_the_card_renders() {
        let p = pool();
        translations::put(
            &p,
            metadata_core::ITEM,
            "m1",
            "en",
            translations::TMDB,
            &td("Arrival", vec![]),
        )
        .unwrap();

        let mut rows = vec![SectionItem::Movie {
            item: Box::new(item("m1", Kind::Movie)),
        }];
        overlay_section_items(&p, &mut rows, "en").unwrap();

        let SectionItem::Movie { item } = &rows[0] else {
            panic!("expected a movie row");
        };
        assert_eq!(item.title, "Arrival");
    }

    #[test]
    fn an_item_reached_through_a_wrapper_is_localized_like_any_other() {
        let p = pool();
        translations::put(
            &p,
            metadata_core::ITEM,
            "m1",
            "en",
            translations::TMDB,
            &td("Arrival", vec![]),
        )
        .unwrap();

        // Continue watching, up-next and the player's rail all hand out a
        // MediaItem wrapped in something. Reaching them by slice only is how
        // one row ends up reading in the language the files were scanned in.
        let mut resume = (item("m1", Kind::Movie), 1234);
        overlay_each(&p, std::iter::once(&mut resume.0), "en").unwrap();

        assert_eq!(resume.0.title, "Arrival");
    }

    #[test]
    fn overlay_items_applies_title_and_characters() {
        let p = pool();
        translations::put(
            &p,
            metadata_core::ITEM,
            "m1",
            "fr",
            translations::TMDB,
            &td("Titre FR", vec![Some("Perso FR".into())]),
        )
        .unwrap();
        translations::put(
            &p,
            "episode",
            "e1",
            "fr",
            translations::TMDB,
            &td("Episode FR", vec![]),
        )
        .unwrap();

        let mut items = vec![item("m1", Kind::Movie), item("e1", Kind::Episode)];
        overlay_items(&p, &mut items, "fr").unwrap();

        let m = items[0].metadata.as_ref().unwrap();
        assert_eq!(m.title.as_deref(), Some("Titre FR"));
        assert_eq!(m.cast[0].character.as_deref(), Some("Perso FR"));
        // Untranslated fields keep the blob's original text.
        assert_eq!(m.tagline.as_deref(), Some("orig tagline"));
        assert_eq!(m.genres, vec!["Original".to_string()]);
        assert_eq!(
            items[1].metadata.as_ref().unwrap().title.as_deref(),
            Some("Episode FR")
        );

        // Empty slice is a clean no-op.
        overlay_items(&p, &mut [], "fr").unwrap();
    }

    #[test]
    fn a_locale_overlay_rewrites_the_genre_names_and_leaves_their_ids_alone() {
        let p = pool();
        let tr = TransData {
            genres: vec!["Science-fiction".into()],
            ..Default::default()
        };
        translations::put(&p, metadata_core::ITEM, "m1", "fr", translations::TMDB, &tr).unwrap();
        let mut items = vec![item("m1", Kind::Movie)];

        overlay_items(&p, &mut items, "fr").unwrap();

        let m = items[0].metadata.as_ref().unwrap();
        assert_eq!(m.genres, vec!["Science-fiction".to_string()]);
        assert_eq!(m.tmdb_genre_ids, vec![878]);
    }

    #[test]
    fn a_translation_overlays_every_text_field_it_carries() {
        let p = pool();
        let tr = TransData {
            title: Some("Titre FR".into()),
            tagline: Some("Accroche FR".into()),
            overview: Some("Synopsis FR".into()),
            genres: vec!["Science-fiction".into()],
            characters: vec![Some("Perso FR".into())],
            ..Default::default()
        };
        translations::put(&p, metadata_core::ITEM, "m1", "fr", translations::TMDB, &tr).unwrap();

        let mut items = vec![item("m1", Kind::Movie)];
        overlay_items(&p, &mut items, "fr").unwrap();
        let m = items[0].metadata.as_ref().unwrap();
        assert_eq!(m.title.as_deref(), Some("Titre FR"));
        assert_eq!(m.tagline.as_deref(), Some("Accroche FR"));
        assert_eq!(m.overview.as_deref(), Some("Synopsis FR"));
        assert_eq!(m.genres, vec!["Science-fiction".to_string()]);
        assert_eq!(m.cast[0].character.as_deref(), Some("Perso FR"));

        overlay_section_items(&p, &mut [], "fr").unwrap();
    }
}
