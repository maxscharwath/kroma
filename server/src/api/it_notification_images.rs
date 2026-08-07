//! Integration tests for the admin notification image listing
//! (`GET /api/admin/notifications/images`): only notification uploads come
//! back, newest first, and only to an admin. Files are seeded on disk directly
//! so no ffmpeg/cwebp is needed.

use std::fs;
use std::time::{Duration, SystemTime};

use axum::http::StatusCode;
use serde_json::json;

use crate::api::test_support::{get, seed_session, test_app};
use crate::model::Permission;

fn seed_image(dir: &std::path::Path, name: &str, age: Duration) {
    fs::create_dir_all(dir).expect("images dir");
    let path = dir.join(name);
    fs::write(&path, b"not-really-webp").expect("write image");
    let file = fs::File::options().write(true).open(&path).expect("open image");
    file.set_modified(SystemTime::now() - age).expect("set mtime");
}

#[tokio::test]
async fn only_notification_uploads_are_listed_newest_first() {
    let t = test_app();
    let dir = crate::infra::image::images_dir(&t.state.config.data_dir);
    seed_image(&dir, "notif-aaaaaaaaaaaaaaaa-w1280.webp", Duration::from_secs(60));
    seed_image(&dir, "notif-bbbbbbbbbbbbbbbb-w1280.webp", Duration::from_secs(0));
    // An upload stored before the `notif-` prefix existed stays listed.
    seed_image(&dir, "cccccccccccccccc-w1280.webp", Duration::from_secs(120));
    // A cached poster, an avatar and a sized rendition never appear.
    seed_image(&dir, "dddddddddddddddd.webp", Duration::from_secs(10));
    seed_image(&dir, "eeeeeeeeeeeeeeee-w512.webp", Duration::from_secs(10));
    seed_image(&dir, "notif-aaaaaaaaaaaaaaaa-w1280.webp.w320.webp", Duration::from_secs(5));

    let (status, body) = get(&t.app, "/api/admin/notifications/images", Some(&t.token)).await;
    assert_eq!(status, StatusCode::OK);
    let images = body["images"].as_array().unwrap();
    let names: Vec<&str> = images.iter().map(|i| i["name"].as_str().unwrap()).collect();
    assert_eq!(
        names,
        [
            "notif-bbbbbbbbbbbbbbbb-w1280.webp",
            "notif-aaaaaaaaaaaaaaaa-w1280.webp",
            "cccccccccccccccc-w1280.webp",
        ]
    );
    assert_eq!(images[0]["url"], json!("/api/images/notif-bbbbbbbbbbbbbbbb-w1280.webp"));
    assert!(images[0]["uploadedAt"].as_i64().unwrap() > 0);
    assert!(images[0]["bytes"].as_u64().unwrap() > 0);
}

#[tokio::test]
async fn an_empty_store_lists_nothing() {
    let t = test_app();
    let (status, body) = get(&t.app, "/api/admin/notifications/images", Some(&t.token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["images"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn the_listing_is_closed_without_settings_manage() {
    let t = test_app();
    let (_id, plain) =
        seed_session(&t.state, "plain-img@test.dev", "plain-img", &[Permission::Playback]);

    let (status, _) = get(&t.app, "/api/admin/notifications/images", Some(&plain)).await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, _) = get(&t.app, "/api/admin/notifications/images", None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}
