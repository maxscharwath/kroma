//! Member management: the full account list plus permission / username edits and
//! account removal (the "Membres & partage" table).

use axum::extract::{Path as AxPath, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;

use crate::api::error::lerr;
use crate::api::extract::AuthUser;
use crate::api::util::query;
use crate::db;
use crate::infra::events::ServerEvent;
use crate::model::Permission;
use crate::services::auth;
use crate::state::SharedState;
use axum::routing::{get, patch, post};
use axum::Router;

/// Admin user management. Paths are relative to the `/api/admin` nest.
pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/users", get(list_users))
        .route("/users/{id}", patch(update_user).delete(delete_user))
        .route("/users/{id}/reset", post(reset_user))
        .route("/users/{id}/email-verification", post(send_email_verification))
        .route("/users/{id}/pin", axum::routing::delete(clear_user_pin))
}

/// `GET /api/admin/users` → full member list (the "Membres & partage" table).
pub async fn list_users(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
) -> Result<Response, Response> {
    super::require(&user, Permission::UsersManage)?;
    let (mut users, library_count) = query(&state.db, move |pool| {
        Ok((db::admin_users(&pool)?, db::counts(&pool)?.0))
    })
    .await?;
    for u in &mut users {
        u.online = state.playback.user_online(&u.id);
    }
    Ok(Json(crate::api::dto::AdminUsers {
        users,
        library_count,
    })
    .into_response())
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserBody {
    #[serde(default)]
    pub permissions: Option<Vec<Permission>>,
    #[serde(default)]
    pub username: Option<String>,
}

/// `PATCH /api/admin/users/:id` → update permissions and/or username.
pub async fn update_user(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    AxPath(id): AxPath<String>,
    Json(body): Json<UpdateUserBody>,
) -> Result<Response, Response> {
    super::require(&user, Permission::UsersManage)?;
    let id2 = id.clone();
    let all = query(&state.db, move |pool| db::admin_users(&pool)).await?;
    let Some(target) = all.iter().find(|u| u.id == id2) else {
        return Err(lerr(
            super::user_locale(&user),
            StatusCode::NOT_FOUND,
            "error.userNotFound",
        ));
    };

    if let Some(perms) = body.permissions.clone() {
        // Don't strip the last owner of its management rights.
        let owners = all
            .iter()
            .filter(|u| u.permissions.contains(&Permission::UsersManage))
            .count();
        let target_is_owner = target.permissions.contains(&Permission::UsersManage);
        let removes_owner = !perms.contains(&Permission::UsersManage);
        if target_is_owner && removes_owner && owners <= 1 {
            return Err(lerr(
                super::user_locale(&user),
                StatusCode::BAD_REQUEST,
                "admin.cantRemoveLastOwner",
            ));
        }
        let id3 = id.clone();
        query(&state.db, move |pool| {
            db::update_user_permissions(&pool, &id3, &perms)
        })
        .await?;
    }
    if let Some(name) = body.username.clone().filter(|n| !n.trim().is_empty()) {
        let name = name.trim().to_string();
        // Enforce the same uniqueness the self-service rename does: without this an
        // admin could rename account B to another account's email/username and
        // reintroduce the `find_user_by_login` ambiguity `username_taken` exists to
        // prevent (email and username share one login namespace).
        let check_name = name.clone();
        let exclude = id.clone();
        if query(&state.db, move |pool| {
            db::username_taken(&pool, &check_name, Some(&exclude))
        })
        .await?
        {
            return Err(lerr(
                super::user_locale(&user),
                StatusCode::CONFLICT,
                "auth.usernameTaken",
            ));
        }
        let id3 = id.clone();
        query(&state.db, move |pool| {
            db::set_user_username(&pool, &id3, &name)
        })
        .await?;
    }
    state.events.publish(ServerEvent::LibraryUpdated);
    Ok(StatusCode::NO_CONTENT.into_response())
}

/// `DELETE /api/admin/users/:id` → remove an account.
pub async fn delete_user(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    AxPath(id): AxPath<String>,
) -> Result<Response, Response> {
    super::require(&user, Permission::UsersManage)?;
    if id == user.id {
        return Err(lerr(
            super::user_locale(&user),
            StatusCode::BAD_REQUEST,
            "admin.cantDeleteSelf",
        ));
    }
    let id2 = id.clone();
    if query(&state.db, move |pool| db::user_by_id(&pool, &id2))
        .await?
        .is_none()
    {
        return Err(lerr(
            super::user_locale(&user),
            StatusCode::NOT_FOUND,
            "error.userNotFound",
        ));
    }
    query(&state.db, move |pool| db::delete_user(&pool, &id)).await?;
    state.events.publish(ServerEvent::LibraryUpdated);
    Ok(StatusCode::NO_CONTENT.into_response())
}

/// `POST /api/admin/users/:id/reset` → mint a credential reset. The link alone
/// is not enough; the owner reads the returned code to the user.
pub async fn reset_user(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    AxPath(id): AxPath<String>,
) -> Result<Response, Response> {
    super::require(&user, Permission::UsersManage)?;
    let id2 = id.clone();
    let Some(target) = query(&state.db, move |pool| db::user_by_id(&pool, &id2)).await? else {
        return Err(lerr(
            super::user_locale(&user),
            StatusCode::NOT_FOUND,
            "error.userNotFound",
        ));
    };
    let token = auth::random_token();
    let code = auth::random_code();
    let code_hash = auth::hash_password(&code);
    let expires_at = time::OffsetDateTime::now_utc().unix_timestamp() + 48 * 3600;
    let token_db = token.clone();
    let uid = user.id.clone();
    let id3 = id.clone();
    query(&state.db, move |pool| {
        db::create_reset(&pool, &token_db, &id3, &code_hash, &uid, expires_at)
    })
    .await?;
    let url = web_base(&state).map(|w| format!("{w}/reset?token={token}"));
    // A send failure never fails the mint: the owner can still copy the link and
    // code by hand, which is the default delivery anyway.
    let mut delivered = "manual".to_string();
    if let Some(url) = url.clone() {
        let email = crate::services::email::OutboundEmail {
            to: target.email.clone(),
            locale: super::user_locale(&target),
            url,
            server_name: state.settings.get_str("serverName", "KROMA"),
            kind: crate::services::email::EmailKind::Reset,
        };
        if let Ok(mode) = crate::services::email::send(&state.settings, &email).await {
            delivered = mode.to_string();
        }
    }
    Ok(Json(crate::api::dto::ResetCreated {
        token,
        code,
        url,
        expires_at,
        delivered,
    })
    .into_response())
}

/// `POST /api/admin/users/:id/email-verification` → mint a verification link for
/// the account's current address and try to deliver it. No code: reaching the
/// mailbox is itself the proof. A send failure never fails the mint; the owner
/// can still copy the link by hand.
pub async fn send_email_verification(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    AxPath(id): AxPath<String>,
) -> Result<Response, Response> {
    super::require(&user, Permission::UsersManage)?;
    let id2 = id.clone();
    let Some(target) = query(&state.db, move |pool| db::user_by_id(&pool, &id2)).await? else {
        return Err(lerr(
            super::user_locale(&user),
            StatusCode::NOT_FOUND,
            "error.userNotFound",
        ));
    };
    let token = auth::random_token();
    let expires_at = time::OffsetDateTime::now_utc().unix_timestamp() + 7 * 24 * 3600;
    let token_db = token.clone();
    let uid = user.id.clone();
    let id3 = id.clone();
    let email = target.email.clone();
    query(&state.db, move |pool| {
        db::create_verification(&pool, &token_db, &id3, &email, &uid, expires_at)
    })
    .await?;
    let url = web_base(&state).map(|w| format!("{w}/verify-email?token={token}"));
    let mut delivered = "manual".to_string();
    if let Some(url) = url.clone() {
        let outbound = crate::services::email::OutboundEmail {
            to: target.email.clone(),
            locale: super::user_locale(&target),
            url,
            server_name: state.settings.get_str("serverName", "KROMA"),
            kind: crate::services::email::EmailKind::Verify,
        };
        if let Ok(mode) = crate::services::email::send(&state.settings, &outbound).await {
            delivered = mode.to_string();
        }
    }
    Ok(Json(crate::api::dto::VerificationCreated {
        token,
        url,
        expires_at,
        delivered,
    })
    .into_response())
}

/// `DELETE /api/admin/users/:id/pin` → clear a user's profile PIN. The PIN is a
/// local convenience lock, not the credential, so clearing is the only verb the
/// owner needs; remembered devices re-lock and ask for the credential on the
/// next switch-in.
pub async fn clear_user_pin(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    AxPath(id): AxPath<String>,
) -> Result<Response, Response> {
    super::require(&user, Permission::UsersManage)?;
    let id2 = id.clone();
    if query(&state.db, move |pool| db::user_by_id(&pool, &id2))
        .await?
        .is_none()
    {
        return Err(lerr(
            super::user_locale(&user),
            StatusCode::NOT_FOUND,
            "error.userNotFound",
        ));
    }
    let id3 = id.clone();
    query(&state.db, move |pool| {
        db::set_user_pin(&pool, &id3, None)?;
        db::reset_access_pin_verified(&pool, &id3)
    })
    .await?;
    crate::api::pin::reset(&id);
    state.events.publish(ServerEvent::LibraryUpdated);
    Ok(StatusCode::NO_CONTENT.into_response())
}

/// The base reset/verify links are built against: the configured web URL, else
/// the Remote Access public URL (the same fallback quick-connect links use).
/// Still `None` when neither is set — the client then composes from its own
/// origin, which is right for an owner browsing the very server they admin.
fn web_base(state: &SharedState) -> Option<String> {
    state.config.web_url.clone().or_else(|| {
        let url = crate::services::settings::public_url(&state.settings);
        (!url.is_empty()).then_some(url)
    })
}
