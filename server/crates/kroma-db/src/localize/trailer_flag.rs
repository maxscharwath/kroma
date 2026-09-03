use rusqlite::Connection;

use kroma_domain::{Kind, MediaItem};

pub fn enabled(conn: &Connection) -> bool {
    let Ok(raw) = conn.query_row(
        "SELECT value FROM settings WHERE key = 'trailers'",
        [],
        |row| row.get::<_, String>(0),
    ) else {
        return true;
    };
    match serde_json::from_str::<serde_json::Value>(&raw) {
        Ok(serde_json::Value::Bool(on)) => on,
        _ => true,
    }
}

pub fn apply(item: &mut MediaItem, on: bool) {
    let catalog = item.kind == Kind::Movie
        && item
            .metadata
            .as_ref()
            .is_some_and(|m| !m.videos.is_empty());
    item.has_trailer = on && catalog;
    if let Some(meta) = item.metadata.as_mut() {
        meta.videos.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::localize::test_support::*;
    use crate::localize::overlay_items;
    use kroma_domain::TrailerClip;

    fn clip() -> TrailerClip {
        TrailerClip {
            key: "dQw4w9WgXcQ".into(),
            site: "YouTube".into(),
            kind: "Trailer".into(),
            official: true,
            iso_639_1: "en".into(),
            name: "Trailer".into(),
        }
    }

    #[test]
    fn a_movie_with_a_catalog_offers_a_trailer_and_drops_the_clips() {
        let p = pool();
        let mut movie = item("m1", Kind::Movie);
        movie.metadata.as_mut().unwrap().videos = vec![clip()];

        overlay_items(&p, std::slice::from_mut(&mut movie), "en").unwrap();

        assert!(movie.has_trailer);
        assert!(movie.metadata.as_ref().unwrap().videos.is_empty());
    }

    #[test]
    fn trailers_off_hides_the_offer() {
        let p = pool();
        crate::settings_set(&p, "trailers", &serde_json::json!(false)).unwrap();
        let mut movie = item("m1", Kind::Movie);
        movie.metadata.as_mut().unwrap().videos = vec![clip()];

        overlay_items(&p, std::slice::from_mut(&mut movie), "en").unwrap();

        assert!(!movie.has_trailer);
        assert!(movie.metadata.as_ref().unwrap().videos.is_empty());
    }

    #[test]
    fn an_episode_never_offers_a_trailer() {
        let p = pool();
        let mut ep = item("e1", Kind::Episode);
        ep.metadata.as_mut().unwrap().videos = vec![clip()];

        overlay_items(&p, std::slice::from_mut(&mut ep), "en").unwrap();

        assert!(!ep.has_trailer);
        assert!(ep.metadata.as_ref().unwrap().videos.is_empty());
    }
}
