//! Settings management: the grouped settings schema (+ current values) and a
//! patch endpoint that persists changes to the settings store.

use std::collections::BTreeMap;

use axum::extract::{Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::AuthUser;
use crate::infra::events::ServerEvent;
use crate::model::Permission;
use crate::services::settings;
use crate::state::SharedState;

#[derive(Debug, Deserialize)]
pub struct SettingsQuery {
    #[serde(default)]
    pub view: Option<String>,
}

/// `GET /api/admin/settings?view=general|network|transcoder` → grouped schema +
/// current values.
pub async fn get_settings(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    Query(q): Query<SettingsQuery>,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    let view = q.view.unwrap_or_else(|| "general".into());
    let groups = settings::groups(&view, &state.settings, &state.config, super::user_locale(&user));
    Ok(Json(crate::api::dto::SettingsView { view, groups }).into_response())
}

/// `PUT /api/admin/settings` body = `{ key: value, … }` → persist a patch.
pub async fn put_settings(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    Json(patch): Json<BTreeMap<String, Value>>,
) -> Result<Response, Response> {
    super::require(&user, Permission::SettingsManage)?;
    let written = state.settings.set_patch(&state.db, patch);
    state.events.publish(ServerEvent::SettingsUpdated);
    Ok(Json(json!({ "updated": written })).into_response())
}
