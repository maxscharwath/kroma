//! Storage + cache management: volume totals, media/cache usage, and a
//! cache-clear action.

use std::path::Path;

use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use crate::api::util::{blocking, query};
use crate::auth::AuthUser;
use crate::db;
use crate::model::Permission;
use crate::state::SharedState;

/// `GET /api/admin/storage` → volumes, totals, and cache usage.
pub async fn storage(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
) -> Result<Response, Response> {
    super::require_any_admin(&user)?;
    let data_dir = state.config.data_dir.clone();
    let (volumes, media_bytes, cache_bytes) = query(&state.db, move |pool| {
        let volumes = crate::infra::metrics::read_disks();
        let media = db::total_media_bytes(&pool).unwrap_or(0).max(0) as u64;
        let cache =
            dir_size(&data_dir.join("transcode")) + dir_size(&data_dir.join("images"));
        Ok((volumes, media, cache))
    })
    .await?;

    let total: u64 = volumes.iter().map(|v| v.total_bytes).sum();
    let used: u64 = volumes.iter().map(|v| v.used_bytes).sum();
    Ok(Json(crate::api::dto::StorageInfo {
        volumes,
        total_bytes: total,
        used_bytes: used,
        available_bytes: total.saturating_sub(used),
        media_bytes,
        cache: crate::api::dto::CacheInfo {
            dir: state.config.data_dir.join("transcode").to_string_lossy().into_owned(),
            bytes: cache_bytes,
            limit: state.settings.get_str("cacheLimit", "80 Go"),
        },
    })
    .into_response())
}

/// `POST /api/admin/cache/clear` → wipe transcode + image caches.
pub async fn clear_cache(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    let data_dir = state.config.data_dir.clone();
    let freed = blocking(move || {
        let transcode = data_dir.join("transcode");
        let images = data_dir.join("images");
        let freed = dir_size(&transcode) + dir_size(&images);
        clear_dir(&transcode);
        clear_dir(&images);
        Ok(freed)
    })
    .await?;
    Ok(Json(json!({ "freedBytes": freed })).into_response())
}

/// Recursive byte size of a directory tree (0 if missing).
fn dir_size(path: &Path) -> u64 {
    walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

/// Remove a directory's contents (keeping the directory itself).
fn clear_dir(path: &Path) {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let _ = std::fs::remove_dir_all(&p);
            } else {
                let _ = std::fs::remove_file(&p);
            }
        }
    }
}
