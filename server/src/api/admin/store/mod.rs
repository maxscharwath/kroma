//! The admin module Store: browse a registry catalog, install (with automatic
//! dependency resolution + checksum verification), update and uninstall
//! runtime `.kmod` modules. Admin-gated (`settings.manage`); installing native
//! code is an admin-trust action.
//!
//! A "registry" is any static host serving a catalog index (see [`catalog`])
//! plus the `.kmod` files it points at. The Store reads a list of them (see
//! [`registries`]): one pinned official catalog, whose URL the
//! `moduleRegistryUrl` setting overrides, plus any the operator added.

mod catalog;
pub mod install;
mod registries;

use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Extension, Json, Router};
use kroma_module_supervisor::Supervisor;
use serde_json::{json, Value};

use crate::api::extract::AuthUser;
use crate::model::Permission;
use crate::state::SharedState;

// One ceiling for both install paths: the supervisor applies it to a URL fetch.
const MAX_BUNDLE_BYTES: usize = kroma_module_supervisor::MAX_BUNDLE_BYTES as usize;

// Default module registry: the machine-readable index of `.kmod` bundles the
// release workflow attaches to every GitHub Release of this repo.
// `releases/latest/download/...` is a stable URL that always resolves to the
// newest release's asset. Overridable via the `moduleRegistryUrl` setting.
const DEFAULT_REGISTRY: &str =
    "https://github.com/maxscharwath/kroma/releases/latest/download/modules.json";

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/store/install", post(install_upload).layer(DefaultBodyLimit::max(MAX_BUNDLE_BYTES)))
        .route("/store/install-url", post(install_url))
        .route("/store/install-id", post(install_id))
        .route("/store/catalog", get(catalog_view))
        .route("/store/{id}", delete(uninstall))
}

#[derive(serde::Deserialize)]
struct InstallUrl {
    url: String,
    // Verified before install when given; omitted means unverified.
    #[serde(default)]
    sha256: Option<String>,
}

async fn install_url(
    Extension(sup): Extension<Arc<Supervisor>>,
    AuthUser(user): AuthUser,
    Json(body): Json<InstallUrl>,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    let manifest = sup
        .install_from_url(&body.url, body.sha256.as_deref(), None)
        .await
        .map_err(|e| bad(&format!("install failed: {e:#}")))?;
    Ok(Json(json!({
        "id": manifest.get("id"),
        "name": manifest.get("name"),
        "version": manifest.get("version"),
    }))
    .into_response())
}

#[derive(serde::Deserialize)]
struct InstallId {
    id: String,
}

async fn install_id(
    State(state): State<SharedState>,
    Extension(sup): Extension<Arc<Supervisor>>,
    AuthUser(user): AuthUser,
    Json(body): Json<InstallId>,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    let report = install::install_with_deps(&state, &sup, &body.id)
        .await
        .map_err(|e| bad(&format!("install failed: {e:#}")))?;
    Ok(Json(report).into_response())
}

// Fetched server-side (no CORS) across every configured registry and enriched
// per module with this server's verdict. An unreachable registry is NOT an HTTP
// error: its failure is reported on its own row in `registries`, so one dead
// host leaves the rest of the catalog usable.
async fn catalog_view(
    State(state): State<SharedState>,
    Extension(sup): Extension<Arc<Supervisor>>,
    AuthUser(user): AuthUser,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    let fetched = registries::fetch_all(&state, &sup).await;
    Ok(Json(catalog::enriched(&state, &fetched)).into_response())
}

// The manual escape hatch: no registry, no checksum to verify against - the
// upload IS the source.
async fn install_upload(
    Extension(sup): Extension<Arc<Supervisor>>,
    AuthUser(user): AuthUser,
    body: Bytes,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    if body.is_empty() {
        return Err(bad("empty bundle"));
    }
    // Unpack + spawn is blocking; keep it off the async runtime.
    let manifest: Value = tokio::task::spawn_blocking(move || sup.install(&body, None))
        .await
        .map_err(|_| bad("install task panicked"))?
        .map_err(|e| bad(&format!("install failed: {e:#}")))?;
    Ok(Json(json!({
        "id": manifest.get("id"),
        "name": manifest.get("name"),
        "version": manifest.get("version"),
    }))
    .into_response())
}

#[derive(serde::Deserialize, Default)]
struct UninstallQuery {
    // Skips the dependents guard; the UI asks for explicit confirmation first.
    #[serde(default)]
    force: bool,
}

async fn uninstall(
    State(state): State<SharedState>,
    Extension(sup): Extension<Arc<Supervisor>>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
    Query(q): Query<UninstallQuery>,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    // Dependents guard: removing a module other enabled modules hard-depend on
    // would break them at their next port call. Surface who needs it instead.
    if !q.force {
        let dependents: Vec<String> = kroma_module_kernel::manifests(&state)
            .into_iter()
            .filter(|m| m.id != id && m.depends_on.iter().any(|d| d.id == id))
            .filter(|m| kroma_engine::modules::module_enabled(&state.settings, &m.id))
            .map(|m| m.id)
            .collect();
        if !dependents.is_empty() {
            return Err((
                StatusCode::CONFLICT,
                format!(
                    "'{id}' is required by: {}. Disable or uninstall those first, or retry with force=true.",
                    dependents.join(", ")
                ),
            )
                .into_response());
        }
    }
    tokio::task::spawn_blocking(move || sup.uninstall(&id))
        .await
        .map_err(|_| bad("uninstall task panicked"))?
        .map_err(|e| bad(&format!("uninstall failed: {e:#}")))?;
    Ok(Json(json!({ "ok": true })).into_response())
}

fn bad(msg: &str) -> Response {
    (StatusCode::BAD_REQUEST, msg.to_string()).into_response()
}
