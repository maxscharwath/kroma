//! Overlaying a locale onto items and home-section rows.

use super::{apply_item, apply_show};
use crate::{metadata_core, translations, Pool};
use anyhow::Result;

use kroma_domain::{Kind, MediaItem, SectionItem};

/// Overlay `locale` onto a batch of items (movies/videos + episodes). Episodes
/// resolve under the `'episode'` subject kind, everything else under `'item'`.
pub fn overlay_items(pool: &Pool, items: &mut [MediaItem], locale: &str) -> Result<()> {
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
    fn the_entity_title_is_localized_and_not_only_the_blobs_copy() {
        // The bug this pins: every card, rail and hero renders the item's own
        // `title`, and the overlay used to write only `metadata.title`, so a
        // reader asking for English saw the household language in the one place
        // the eye lands first.
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

        let mut items = vec![item("m1", Kind::Movie)];
        overlay_items(&p, &mut items, "en").unwrap();

        assert_eq!(items[0].title, "Arrival");
        assert_eq!(
            items[0].metadata.as_ref().unwrap().title.as_deref(),
            Some("Arrival")
        );
    }

    #[test]
    fn an_item_the_locale_has_no_title_for_keeps_the_one_it_had() {
        let p = pool();
        translations::put(
            &p,
            metadata_core::ITEM,
            "m1",
            "en",
            translations::TMDB,
            &TransData {
                overview: Some("only an overview".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let before = item("m1", Kind::Movie).title;

        let mut items = vec![item("m1", Kind::Movie)];
        overlay_items(&p, &mut items, "en").unwrap();

        assert_eq!(items[0].title, before);
    }

    #[test]
    fn a_blank_translated_title_is_not_a_title() {
        let p = pool();
        translations::put(
            &p,
            metadata_core::ITEM,
            "m1",
            "en",
            translations::TMDB,
            &TransData {
                title: Some("   ".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let before = item("m1", Kind::Movie).title;

        let mut items = vec![item("m1", Kind::Movie)];
        overlay_items(&p, &mut items, "en").unwrap();

        assert_eq!(items[0].title, before);
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
