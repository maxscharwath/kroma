use axum::http::StatusCode;
use serde_json::json;

use crate::api::test_support::{demo_item_id, get, raw, send, test_app};
use crate::db;
use crate::model::TrailerClip;

const KEY: &str = "dQw4w9WgXcQ";

fn clip() -> TrailerClip {
    TrailerClip {
        key: KEY.into(),
        site: "YouTube".into(),
        kind: "Trailer".into(),
        official: true,
        iso_639_1: "en".into(),
        name: "Trailer".into(),
    }
}

fn seed_movie_trailer(t: &crate::api::test_support::TestApp) -> String {
    let id = demo_item_id("The Matrix");
    let item = db::get_item(&t.state.db, &id).unwrap().unwrap();
    let mut meta = item.metadata.unwrap_or_else(|| {
        serde_json::from_value(json!({
            "tmdbId": 603,
            "genres": [],
            "tmdbUrl": "",
        }))
        .unwrap()
    });
    meta.videos = vec![clip()];
    meta.videos_fetched = true;
    db::set_item_metadata(&t.state.db, &id, &meta).unwrap();
    let dir = t.state.config.data_dir.join("trailers");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join(format!("{KEY}.mp4")), vec![0u8; 40 * 1024]).unwrap();
    id
}

#[tokio::test]
async fn a_movie_with_a_catalog_reports_has_trailer_and_hides_the_clips() {
    let t = test_app();
    let id = seed_movie_trailer(&t);

    let (status, item) = get(&t.app, &format!("/api/items/{id}"), Some(&t.token)).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(item["hasTrailer"], json!(true));
    assert!(item["metadata"]["videos"].is_null() || item["metadata"]["videos"] == json!([]));
}

#[tokio::test]
async fn trailer_info_picks_the_catalog_key() {
    let t = test_app();
    let id = seed_movie_trailer(&t);

    let (status, body) = get(&t.app, &format!("/api/items/{id}/trailer"), Some(&t.token)).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["key"], json!(KEY));
    assert_eq!(body["container"], json!("mp4"));
}

#[tokio::test]
async fn prepare_is_fast_when_the_file_is_already_cached() {
    let t = test_app();
    let id = seed_movie_trailer(&t);

    let (status, body) = send(
        &t.app,
        "POST",
        &format!("/api/items/{id}/trailer/prepare"),
        Some(&t.token),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["key"], json!(KEY));
}

#[tokio::test]
async fn a_cached_trailer_stream_honours_range() {
    let t = test_app();
    let id = seed_movie_trailer(&t);

    let (status, headers, _) = raw(
        &t.app,
        "GET",
        &format!("/api/items/{id}/trailer/stream?key={KEY}"),
        None,
        None,
        &[("range", "bytes=0-99")],
    )
    .await;

    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(
        headers.get("content-range").map(|v| v.to_str().unwrap()),
        Some("bytes 0-99/40960")
    );
}

#[tokio::test]
async fn a_trailer_still_streams_when_the_movie_file_is_offline() {
    let t = test_app();
    let id = seed_movie_trailer(&t);
    t.state
        .db
        .get()
        .expect("a connection")
        .execute(
            "UPDATE files SET abs_path = ?2 WHERE item_id = ?1",
            rusqlite::params![id, "/nowhere/kroma/the-matrix.mkv"],
        )
        .expect("the movie file sits on an offline mount");

    let (status, _, body) = raw(
        &t.app,
        "GET",
        &format!("/api/items/{id}/trailer/stream?key={KEY}"),
        None,
        None,
        &[("range", "bytes=0-99")],
    )
    .await;

    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_ne!(
        body["error"],
        json!("media file unavailable (mount offline?)")
    );
}

#[tokio::test]
async fn a_key_that_is_not_in_the_catalog_is_not_a_stream() {
    let t = test_app();
    let id = seed_movie_trailer(&t);

    let (status, _) = get(
        &t.app,
        &format!("/api/items/{id}/trailer/stream?key=notThisKey12"),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn a_junk_key_is_refused() {
    let t = test_app();
    let id = seed_movie_trailer(&t);

    let (status, _) = get(
        &t.app,
        &format!("/api/items/{id}/trailer/stream?key=../etc"),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn an_episode_has_no_trailer() {
    let t = test_app();
    let ep = crate::services::demo::demo_data()
        .items
        .into_iter()
        .find(|i| i.episode_title.as_deref() == Some("Islands"))
        .expect("demo episode");

    let (status, _) = get(
        &t.app,
        &format!("/api/items/{}/trailer", ep.id),
        Some(&t.token),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn trailers_off_hides_the_action_and_the_stream() {
    let t = test_app();
    let id = seed_movie_trailer(&t);
    t.state.settings.set_patch(
        &t.state.db,
        [("trailers".to_string(), json!(false))]
            .into_iter()
            .collect(),
    );

    let (status, item) = get(&t.app, &format!("/api/items/{id}"), Some(&t.token)).await;
    let (info_status, _) = get(&t.app, &format!("/api/items/{id}/trailer"), Some(&t.token)).await;
    let (stream_status, _) = get(
        &t.app,
        &format!("/api/items/{id}/trailer/stream?key={KEY}"),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_ne!(item["hasTrailer"], json!(true));
    assert_eq!(info_status, StatusCode::NOT_FOUND);
    assert_eq!(stream_status, StatusCode::NOT_FOUND);
}
