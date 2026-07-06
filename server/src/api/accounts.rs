//! Accounts, sessions, profile avatar/language, and Quick Connect handlers.
//!
//! Auth is by opaque bearer token (see [`crate::services::auth`]). The catalogue/stream
//! endpoints stay open (LAN trust model); only these per-user routes require a
//! valid session via the [`AuthUser`] extractor.

use std::net::SocketAddr;

use axum::body::Bytes;
use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::api::error::lerr;
use crate::api::util::{blocking, client_ip, query};
use crate::api::extract::{bearer_from_headers, AuthUser};
use crate::services::auth;
use crate::services::loginguard;
use crate::db;
use crate::i18n::{self, ReqLocale};
use crate::model::{Permission, PublicUser, User};
use crate::services::quickconnect::PollState;
use crate::state::SharedState;
use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use axum::Router;

/// Auth, sessions, profiles, Quick Connect and the user roster. PIN routes live
/// in [`super::pin`]; invitations in [`super::invites`].
pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/auth/config", get(auth_config))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me).patch(update_me))
        .route("/auth/quickconnect/initiate", post(quick_initiate))
        .route("/auth/quickconnect/authorize", post(quick_authorize))
        .route("/auth/quickconnect/poll", get(quick_poll))
        .route("/users", get(list_users))
        .route(
            "/users/avatar",
            post(upload_avatar).layer(DefaultBodyLimit::max(MAX_AVATAR_BYTES)),
        )
}

/// Max avatar upload size (raw image bytes).
pub const MAX_AVATAR_BYTES: usize = 8 * 1024 * 1024;

// ----- auth -------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct RegisterBody {
    pub email: String,
    pub username: String,
    pub password: String,
    /// Invitation token. Required for every account after the bootstrap owner
    /// registration is invite-only (an admin with `users.manage` mints invites).
    #[serde(rename = "inviteToken", default)]
    pub invite_token: Option<String>,
}

/// `POST /api/auth/register` → `{ token, user }` (also opens a session).
///
/// The **first** account ever created is the owner (gets every permission, no
/// invite needed). After that, registration requires a valid `inviteToken`; the
/// new account inherits the invite's permissions.
pub async fn register(
    State(state): State<SharedState>,
    ReqLocale(loc): ReqLocale,
    Json(body): Json<RegisterBody>,
) -> Response {
    let email = body.email.trim().to_lowercase();
    let username = body.username.trim().to_string();
    if email.is_empty() || !email.contains('@') || username.is_empty() || body.password.len() < 4 {
        return lerr(loc, StatusCode::BAD_REQUEST, "auth.registerInvalid");
    }

    // How many accounts exist already decides whether this is the bootstrap
    // owner (no invite needed) or an invite-gated signup.
    let count = match query(&state.db, move |pool| db::user_count(&pool)).await {
        Ok(n) => n,
        Err(resp) => return resp,
    };

    // Reject a duplicate email *before* consuming any invite. Otherwise a typo or
    // a retry against an already-registered email spends the single-use invite
    // and locks the invitee out. (The UNIQUE constraint in `create_user` remains
    // the atomic backstop for the residual check-then-create window.)
    let email_check = email.clone();
    match query(&state.db, move |pool| db::find_user_by_email(&pool, &email_check)).await {
        Ok(Some(_)) => return lerr(loc, StatusCode::CONFLICT, "auth.emailTaken"),
        Ok(None) => {}
        Err(resp) => return resp,
    }

    // Decide the granted permissions: bootstrap owner → all; otherwise consume
    // the invite (registration is closed without one). Done after the email check
    // so the invite is only burned once we know the account can be created.
    let permissions = if count == 0 {
        Permission::all()
    } else {
        let Some(token) = body.invite_token.clone().filter(|t| !t.trim().is_empty()) else {
            return lerr(loc, StatusCode::FORBIDDEN, "auth.inviteOnly");
        };
        match query(&state.db, move |pool| db::consume_invite(&pool, token.trim())).await {
            Ok(Some(perms)) => perms,
            Ok(None) => return lerr(loc, StatusCode::FORBIDDEN, "auth.inviteInvalid"),
            Err(resp) => return resp,
        }
    };

    let hash = auth::hash_password(&body.password);
    let user =
        match query(&state.db, move |pool| db::create_user(&pool, &email, &username, &hash, &permissions)).await
        {
            Ok(u) => u,
            Err(resp) => return resp,
        };
    issue_session(state, user).await
}

#[derive(Debug, Deserialize)]
pub struct LoginBody {
    /// Email or username the profile picker only knows usernames.
    pub email: String,
    pub password: String,
}

/// `POST /api/auth/login` → `{ token, user }`. Accepts email or username.
///
/// Brute-force guarded per source IP (see [`loginguard`]): after a handful of
/// consecutive failures the IP is locked out for an escalating cooldown and gets
/// `429` with a `retryAfter`, so an online password-guessing attack is throttled.
pub async fn login(
    State(state): State<SharedState>,
    ReqLocale(loc): ReqLocale,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<LoginBody>,
) -> Response {
    let ip = client_ip(&headers, &addr);
    // Reject while locked out *before* touching the database or hashing.
    if let Some(secs) = loginguard::lock_remaining(&ip) {
        return login_locked(&loc, secs);
    }

    let identifier = body.email.trim().to_string();
    let found = match query(&state.db, move |pool| db::find_user_by_login(&pool, &identifier)).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };
    // Same response whether the email is unknown or the password is wrong.
    let Some((user, hash)) = found else {
        return login_failed(&ip, &loc);
    };
    if !auth::verify_password(&body.password, &hash) {
        return login_failed(&ip, &loc);
    }
    // A correct login clears the source's failure record.
    loginguard::reset(&ip);
    issue_session(state, user).await
}

/// Record a failed login for `ip` and turn it into a response: `429` with a
/// `retryAfter` once the failure trips a lockout, otherwise the usual `401`.
fn login_failed(ip: &str, loc: &str) -> Response {
    let locked = loginguard::record_fail(ip);
    if locked > 0 {
        login_locked(loc, locked)
    } else {
        lerr(loc, StatusCode::UNAUTHORIZED, "auth.invalidCredentials")
    }
}

/// `429 Too Many Requests` carrying a `retryAfter` (seconds) the client surfaces
/// as a cooldown. Mirrors the PIN lockout shape in [`super::pin`].
fn login_locked(loc: &str, secs: i64) -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        Json(json!({ "error": i18n::t(loc, "auth.loginLocked", &[]), "retryAfter": secs })),
    )
        .into_response()
}

/// `POST /api/auth/logout` → 204. No-op if the token is missing/unknown.
pub async fn logout(State(state): State<SharedState>, headers: HeaderMap) -> Response {
    if let Some(token) = bearer_from_headers(&headers) {
        let _ = query(&state.db, move |pool| db::delete_session(&pool, &token)).await;
    }
    StatusCode::NO_CONTENT.into_response()
}

/// `GET /api/auth/config` → `{ publicUserList, hasAccounts }`. Unauthenticated:
/// the login gate reads it *before* any credential to decide what to show
/// register (no accounts yet), the profile picker (roster is public), or a plain
/// email/password form (roster hidden).
pub async fn auth_config(State(state): State<SharedState>) -> Response {
    let has_accounts = match query(&state.db, move |pool| db::user_count(&pool)).await {
        Ok(n) => n > 0,
        // On a DB error, assume the server is set up don't expose registration.
        Err(_) => true,
    };
    Json(super::dto::AuthConfig {
        public_user_list: state.settings.get_bool("publicUserList", false),
        has_accounts,
    })
    .into_response()
}

/// `GET /api/auth/me` (Bearer) → `{ user }`.
pub async fn me(AuthUser(user): AuthUser) -> Response {
    Json(json!({ "user": user })).into_response()
}

#[derive(Debug, Deserialize)]
pub struct UpdateMeBody {
    /// Preferred UI locale, e.g. `"fr"` | `"en"`. `null` clears it (fall back to
    /// the device locale). Unknown tags are ignored (left unchanged).
    #[serde(default)]
    pub language: Option<String>,
}

/// `PATCH /api/auth/me` (Bearer) `{ language }` → `{ user }`. Persists the
/// account's preferred UI locale so it follows the profile across devices.
pub async fn update_me(
    State(state): State<SharedState>,
    AuthUser(mut user): AuthUser,
    Json(body): Json<UpdateMeBody>,
) -> Response {
    // Normalise to a supported code; an unknown/garbage tag leaves it unchanged.
    let language = body.language.as_deref().and_then(i18n::normalize);
    let uid = user.id.clone();
    if let Err(resp) = query(&state.db, move |pool| db::set_user_language(&pool, &uid, language)).await {
        return resp;
    }
    user.language = language.map(str::to_string);
    Json(json!({ "user": user })).into_response()
}

/// Mint a session token for `user` and return `{ token, user }`.
async fn issue_session(state: SharedState, user: User) -> Response {
    let token = auth::random_token();
    let expires_at = time::OffsetDateTime::now_utc().unix_timestamp() + auth::SESSION_TTL_SECS;
    let token_db = token.clone();
    let uid = user.id.clone();
    if let Err(resp) = query(&state.db, move |pool| db::create_session(&pool, &token_db, &uid, expires_at)).await
    {
        return resp;
    }
    // Best-effort last-seen stamp for the admin members table.
    let uid = user.id.clone();
    let _ = query(&state.db, move |pool| {
        let _ = db::touch_last_seen(&pool, &uid);
        Ok(())
    })
    .await;
    Json(super::dto::AuthResult { token, user }).into_response()
}

// ----- profiles ---------------------------------------------------------------

/// `GET /api/users` → `PublicUser[]` for the "Qui regarde ?" picker (no emails).
///
/// Gated by the `publicUserList` setting (off by default). When disabled the
/// roster is *not* enumerable: this returns an empty list rather than every
/// account, so simply knowing the server URL no longer reveals who has an
/// account. Clients fall back to a plain email/password login (see
/// [`auth_config`]).
pub async fn list_users(State(state): State<SharedState>) -> Response {
    if !state.settings.get_bool("publicUserList", false) {
        return Json(Vec::<PublicUser>::new()).into_response();
    }
    match query(&state.db, move |pool| db::list_users(&pool)).await {
        Ok(users) => Json(users).into_response(),
        Err(resp) => resp,
    }
}

/// `POST /api/users/avatar` (Bearer, body = raw `image/*`) → `{ avatarUrl }`.
/// The image is transcoded to WebP and stored in the shared image cache.
pub async fn upload_avatar(
    State(state): State<SharedState>,
    ReqLocale(loc): ReqLocale,
    AuthUser(user): AuthUser,
    body: Bytes,
) -> Response {
    if body.is_empty() {
        return lerr(loc, StatusCode::BAD_REQUEST, "error.emptyBody");
    }
    if body.len() > MAX_AVATAR_BYTES {
        return lerr(loc, StatusCode::PAYLOAD_TOO_LARGE, "error.imageTooLarge");
    }

    let data_dir = state.config.data_dir.clone();
    let bytes = body.to_vec();
    let url = match blocking(move || Ok(crate::infra::image::store_upload(&data_dir, &bytes))).await {
        Ok(Some(u)) => u,
        Ok(None) => return lerr(loc, StatusCode::UNSUPPORTED_MEDIA_TYPE, "error.imageUnreadable"),
        Err(resp) => return resp,
    };

    let uid = user.id.clone();
    let url_db = url.clone();
    if let Err(resp) = query(&state.db, move |pool| db::set_user_avatar(&pool, &uid, Some(&url_db))).await {
        return resp;
    }
    Json(json!({ "avatarUrl": url })).into_response()
}

// ----- quick connect ----------------------------------------------------------

/// `POST /api/auth/quickconnect/initiate` → `{ code, secret, expiresInSec,
/// authorizeUrl? }`. The device shows `code` (and a QR of `authorizeUrl` when
/// the server knows the web app URL) and then polls with `secret`.
pub async fn quick_initiate(State(state): State<SharedState>) -> Response {
    let init = state.quickconnect.initiate();
    let authorize_url = state
        .config
        .web_url
        .as_ref()
        .map(|w| format!("{w}/connect?code={}", init.code));
    Json(super::dto::QuickConnectInit {
        code: init.code,
        secret: init.secret,
        expires_in_sec: init.expires_in,
        authorize_url,
    })
    .into_response()
}

#[derive(Debug, Deserialize)]
pub struct QuickAuthorizeBody {
    pub code: String,
}

/// `POST /api/auth/quickconnect/authorize` (Bearer) `{ code }` → 204. Approves a
/// device's code for the signed-in user, minting the session the device will
/// receive on its next poll.
pub async fn quick_authorize(
    State(state): State<SharedState>,
    ReqLocale(loc): ReqLocale,
    AuthUser(user): AuthUser,
    Json(body): Json<QuickAuthorizeBody>,
) -> Response {
    let code = body.code.trim().to_string();
    let token = auth::random_token();
    let expires_at = time::OffsetDateTime::now_utc().unix_timestamp() + auth::SESSION_TTL_SECS;
    let token_db = token.clone();
    let uid = user.id.clone();
    if let Err(resp) = query(&state.db, move |pool| db::create_session(&pool, &token_db, &uid, expires_at)).await
    {
        return resp;
    }

    if state.quickconnect.authorize(&code, user, token.clone()) {
        StatusCode::NO_CONTENT.into_response()
    } else {
        // Unknown/expired code → don't leave the just-created session dangling.
        let _ = query(&state.db, move |pool| db::delete_session(&pool, &token)).await;
        lerr(loc, StatusCode::NOT_FOUND, "connect.invalidCode")
    }
}

#[derive(Debug, Deserialize)]
pub struct QuickPollQuery {
    pub secret: String,
}

/// `GET /api/auth/quickconnect/poll?secret=…` → `{ status }` where status is
/// `pending` | `authorized` (then `{ token, user }`) | `expired`.
pub async fn quick_poll(State(state): State<SharedState>, Query(q): Query<QuickPollQuery>) -> Response {
    let status = match state.quickconnect.poll(&q.secret) {
        PollState::Authorized { token, user } => super::dto::QuickPoll::Authorized { token, user },
        PollState::Pending => super::dto::QuickPoll::Pending,
        PollState::Unknown => super::dto::QuickPoll::Expired,
    };
    Json(status).into_response()
}
