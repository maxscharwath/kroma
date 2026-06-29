//! Portable backup: export the server's identity state (accounts, settings,
//! history, resume positions, invites, cron overrides) as a JSON file, and
//! import it on another server. Import restores the rows, reloads the settings
//! store, then kicks a re-scan so the catalogue regenerates with the same item
//! IDs (the library defs travel inside `settings`). See [`crate::db::backup`].

use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use crate::api::error::{json_error, lerr};
use crate::api::extract::AuthUser;
use crate::api::util::query;
use crate::db::{self, BackupDoc};
use crate::infra::events::ServerEvent;
use crate::model::Permission;
use crate::state::SharedState;

/// `GET /api/admin/backup/export` → download a portable backup as a JSON file.
/// Contains credentials (password hashes, API keys) → gated by `SettingsManage`.
pub async fn export_backup(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    let doc = query(&state.db, |pool| db::export_portable(&pool)).await?;
    let body = serde_json::to_vec_pretty(&doc)
        .map_err(|_| json_error(StatusCode::INTERNAL_SERVER_ERROR, "serialize backup"))?;
    let filename = format!("luma-backup-{}.json", doc.exported_at.replace(':', "-"));
    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{filename}\""))
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(body))
        .unwrap())
}

/// `POST /api/admin/backup/import` body = a backup JSON file → restore it, then
/// re-scan. Replaces accounts/settings/history by primary key. `SettingsManage`.
pub async fn import_backup(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    body: Bytes,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    let locale = super::user_locale(&user);
    let doc: BackupDoc = serde_json::from_slice(&body)
        .map_err(|_| lerr(locale, StatusCode::BAD_REQUEST, "admin.backupInvalid"))?;

    let summary = query(&state.db, move |pool| db::import_portable(&pool, &doc)).await?;

    // Reflect the restored config, then regenerate the catalogue (same item IDs)
    // so progress/history re-link to their items.
    state.settings.reload(&state.db);
    state.events.publish(ServerEvent::SettingsUpdated);
    spawn_rescan(state.clone());

    let counts: serde_json::Map<String, serde_json::Value> =
        summary.into_iter().map(|(t, n)| (t, json!(n))).collect();
    Ok(Json(json!({ "imported": counts, "rescanStarted": true })).into_response())
}

/// Background re-scan after an import — mirrors `api::admin::libraries::spawn_rescan`
/// but reuses the shared [`crate::services::scan::scan_and_publish`] path.
fn spawn_rescan(state: SharedState) {
    tokio::spawn(async move {
        let st = state.clone();
        match tokio::task::spawn_blocking(move || crate::services::scan::scan_and_publish(&st)).await {
            Ok(Ok(data)) => crate::services::scan::spawn_follow_ups(&state, &data),
            Ok(Err(e)) => tracing::error!(error = %e, "post-import rescan failed"),
            Err(e) => tracing::error!(error = %e, "post-import rescan task join failed"),
        }
    });
}
