//! TMDB video-list catalog: store it on the title, backfill matched libraries.

use std::sync::{Arc, Mutex};
use std::thread;

use kroma_domain::{Kind, MediaItem, Metadata, TrailerClip};

use crate::db::{self, Pool};
use crate::infra::events::ServerEvent;
use crate::infra::metadata;
use crate::state::SharedState;

use super::TrailerError;

pub const CATALOG_REV: u32 = 1;

const WORKERS: usize = 8;

pub fn fill_catalog(pool: &Pool, api_key: Option<&str>, item: &MediaItem) -> bool {
    if !needs_catalog(item) {
        return false;
    }
    match ensure_catalog(pool, api_key, item) {
        Ok(_) | Err(TrailerError::None) => true,
        Err(_) => false,
    }
}

pub fn fill_matched(pool: &Pool, api_key: &str, item_id: &str) -> bool {
    let Ok(Some(item)) = db::get_item(pool, item_id) else {
        return false;
    };
    fill_catalog(pool, Some(api_key), &item)
}

pub fn maybe_spawn(state: &SharedState) {
    if !crate::services::settings::trailers_enabled(&state.settings) {
        return;
    }
    if state.config.tmdb_api_key.is_none() {
        return;
    }
    let items = pending_movies(&state.db);
    if items.is_empty() {
        return;
    }
    tracing::info!(titles = items.len(), "filling trailer catalogs");
    let state = state.clone();
    thread::spawn(move || drain(state, items));
}

pub fn attach_movie_videos(api_key: &str, meta: &mut Metadata) {
    if meta.tmdb_id == 0 || meta.videos_fetched || !meta.videos.is_empty() {
        return;
    }
    if let Ok(clips) = metadata::movie_videos(api_key, meta.tmdb_id) {
        meta.videos = clips;
        meta.videos_fetched = true;
    }
}

pub(super) fn ensure_catalog(
    pool: &Pool,
    api_key: Option<&str>,
    item: &MediaItem,
) -> Result<Vec<TrailerClip>, TrailerError> {
    if let Some(meta) = item.metadata.as_ref() {
        if meta.videos_fetched {
            return if meta.videos.is_empty() {
                Err(TrailerError::None)
            } else {
                Ok(meta.videos.clone())
            };
        }
        if !meta.videos.is_empty() {
            return Ok(meta.videos.clone());
        }
    }
    let tmdb_id = item
        .metadata
        .as_ref()
        .map(|m| m.tmdb_id)
        .filter(|id| *id != 0)
        .ok_or(TrailerError::None)?;
    let api_key = api_key.ok_or(TrailerError::Unavailable)?;
    let clips = metadata::movie_videos(api_key, tmdb_id).map_err(|()| TrailerError::Unavailable)?;
    if let Some(mut meta) = item.metadata.clone() {
        meta.videos = clips.clone();
        meta.videos_fetched = true;
        let _ = db::set_item_metadata(pool, &item.id, &meta);
    }
    if clips.is_empty() {
        return Err(TrailerError::None);
    }
    Ok(clips)
}

#[cfg(test)]
pub(crate) fn fill_pending(state: &SharedState) {
    if !crate::services::settings::trailers_enabled(&state.settings) {
        return;
    }
    for item in pending_movies(&state.db) {
        fill_one(state, &item);
    }
}

fn drain(state: SharedState, items: Vec<MediaItem>) {
    let n = items.len();
    let queue = Arc::new(Mutex::new(items));
    let workers = n.clamp(1, WORKERS);
    let mut handles = Vec::with_capacity(workers);
    for _ in 0..workers {
        let queue = Arc::clone(&queue);
        let state = state.clone();
        handles.push(thread::spawn(move || {
            while let Some(item) = queue.lock().unwrap().pop() {
                fill_one(&state, &item);
            }
        }));
    }
    for handle in handles {
        let _ = handle.join();
    }
    state.events.publish(ServerEvent::LibraryUpdated);
}

fn fill_one(state: &SharedState, item: &MediaItem) {
    if fill_catalog(&state.db, state.config.tmdb_api_key.as_deref(), item) {
        state.events.publish(ServerEvent::ItemUpdated {
            id: item.id.clone(),
        });
    }
}

fn pending_movies(pool: &Pool) -> Vec<MediaItem> {
    db::list_movies(pool, None)
        .unwrap_or_default()
        .into_iter()
        .filter(needs_catalog)
        .collect()
}

fn needs_catalog(item: &MediaItem) -> bool {
    item.kind == Kind::Movie
        && item
            .metadata
            .as_ref()
            .is_some_and(|m| m.tmdb_id != 0 && !m.videos_fetched && m.videos.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{seed_movie, test_state_with_tmdb, FakeTmdb};

    fn matched(tmdb: u64) -> Metadata {
        serde_json::from_str(&format!(
            r#"{{"tmdbId":{tmdb},"title":"X","overview":null,"genres":[],"tmdbUrl":"https://x/{tmdb}"}}"#
        ))
        .unwrap()
    }

    fn youtube_videos() -> serde_json::Value {
        serde_json::json!({
            "results": [{
                "key": "abcTrailer1",
                "site": "YouTube",
                "type": "Trailer",
                "official": true,
                "iso_639_1": "en",
                "name": "Trailer"
            }]
        })
    }

    fn tmdb_route(path: &str) -> (u16, serde_json::Value) {
        if path.ends_with("/videos") {
            (200, youtube_videos())
        } else {
            (200, serde_json::json!({ "id": 603, "title": "X" }))
        }
    }

    fn stored_videos(state: &crate::state::SharedState, id: &str) -> (bool, Vec<String>) {
        let meta = crate::db::get_item(&state.db, id)
            .unwrap()
            .unwrap()
            .metadata
            .unwrap();
        (
            meta.videos_fetched,
            meta.videos.into_iter().map(|c| c.key).collect(),
        )
    }

    #[test]
    fn an_already_matched_movie_gains_a_catalog_when_enriched_again() {
        let state = test_state_with_tmdb("k");
        seed_movie(&state, "m1");
        crate::db::set_item_metadata(&state.db, "m1", &matched(603)).unwrap();
        let _tmdb = FakeTmdb::start(tmdb_route);

        crate::services::enrich::enrich_one(&state, "m1", false).unwrap();

        let (fetched, keys) = stored_videos(&state, "m1");
        assert!(fetched);
        assert_eq!(keys, ["abcTrailer1"]);
    }

    #[test]
    fn filling_pending_catalogs_asks_only_movies_that_still_need_one() {
        let state = test_state_with_tmdb("k");
        seed_movie(&state, "m-need");
        seed_movie(&state, "m-has");
        crate::db::set_item_metadata(&state.db, "m-need", &matched(603)).unwrap();
        let mut has = matched(604);
        has.videos_fetched = true;
        crate::db::set_item_metadata(&state.db, "m-has", &has).unwrap();
        let tmdb = FakeTmdb::start(tmdb_route);

        fill_pending(&state);

        let (fetched, keys) = stored_videos(&state, "m-need");
        assert!(fetched);
        assert_eq!(keys, ["abcTrailer1"]);
        assert!(stored_videos(&state, "m-has").1.is_empty());
        assert_eq!(
            tmdb.requests()
                .iter()
                .filter(|r| r.contains("/videos"))
                .count(),
            1
        );
    }

    #[test]
    fn a_provider_error_does_not_mark_the_catalog_fetched() {
        let state = test_state_with_tmdb("k");
        seed_movie(&state, "m1");
        crate::db::set_item_metadata(&state.db, "m1", &matched(603)).unwrap();
        let tmdb = FakeTmdb::start(|_| (500, serde_json::json!({})));

        fill_pending(&state);

        let (fetched, keys) = stored_videos(&state, "m1");
        assert!(!fetched);
        assert!(keys.is_empty());
        assert!(tmdb.requests().iter().any(|r| r.contains("/videos")));
    }
}
