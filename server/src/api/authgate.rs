//! Global authentication gate for the `/api` surface.
//!
//! Applied as a middleware layer on the whole app (see [`super::router`]). The
//! trust model: every `/api` route requires a valid session, with two carve-outs
//!
//! 1. A small **public allow-list** the sign-in surface a client must reach
//!    *before* it has a token (auth config, login, register, Quick Connect
//!    initiate/poll, the roster picker, an invite preview, health).
//! 2. **Media routes** (`/api/images`, `/api/themes`, `/api/events`, and the
//!    per-item stream / HLS / storyboard / poster / subtitle-track endpoints) are
//!    loaded by `<img>`/`<video>`/`<track>` tags and the events WebSocket, none
//!    of which can send an `Authorization` header. Those also accept a
//!    short-lived, media-scoped token in the `?t=` query (see
//!    [`crate::services::media_token::mint_media_token`]). The gate never honours that
//!    token on any other route, so a URL-exposed media token can't be replayed
//!    against the JSON/admin surface.
//!
//! Non-`/api` paths (the SPA shell + static assets) pass straight through so the
//! login page can load. The whole gate is a no-op when the `requireAuth` setting
//! is off (the legacy open LAN-trust model).

use axum::extract::{Request, State};
use axum::http::{Method, StatusCode};
use axum::middleware::Next;
use axum::response::Response;

use crate::api::error::json_error;
use crate::api::extract::bearer_from_headers;
use crate::state::SharedState;

/// Require a valid session (or, for media routes, a valid media token) for every
/// guarded `/api` request.
pub async fn require_auth(State(state): State<SharedState>, mut req: Request, next: Next) -> Response {
    let path = req.uri().path().to_owned();

    // Only the API is gated; the SPA shell and static assets stay public.
    if !path.starts_with("/api/") {
        return next.run(req).await;
    }
    // Escape hatch: admins can restore the fully-open LAN-trust model.
    if !state.settings.get_bool("requireAuth", true) {
        return next.run(req).await;
    }

    let method = req.method().clone();
    // CORS preflight carries no credentials; let it through (CORS answers it).
    if method == Method::OPTIONS || is_public(&method, &path) {
        return next.run(req).await;
    }

    // A full session (bearer token) grants access to everything. Stash the
    // resolved user in the request extensions so the handler's `AuthUser` /
    // `OptionalAuthUser` extractor reuses it instead of hitting the DB a second
    // time (see [`crate::api::extract`]).
    if let Some(token) = bearer_from_headers(req.headers()) {
        let pool = state.db.clone();
        let user = tokio::task::spawn_blocking(move || crate::db::session_user(&pool, &token))
            .await
            .ok()
            .and_then(|r| r.ok())
            .flatten();
        if let Some(user) = user {
            req.extensions_mut().insert(user);
            return next.run(req).await;
        }
    }

    // Media/asset routes additionally accept a media-scoped `?t=` token.
    if is_media(&method, &path) {
        if let Some(tok) = query_param(req.uri().query(), "t") {
            // Recovers the bound user id (available for access logging / per-user
            // gating); the gate only needs that it is valid.
            if crate::services::media_token::verify_media_token(&state.media_secret, &tok).is_some() {
                return next.run(req).await;
            }
        }
    }

    json_error(StatusCode::UNAUTHORIZED, "authentication required")
}

/// Routes reachable without any session the sign-in surface a fresh client hits
/// before it can hold a token, plus the health probe.
fn is_public(method: &Method, path: &str) -> bool {
    match (method, path) {
        (_, "/api/health") => true,
        // Sign-in surface: the login gate reads config, then logs in / registers.
        (&Method::GET, "/api/auth/config") => true,
        (&Method::POST, "/api/auth/register") => true,
        (&Method::POST, "/api/auth/login") => true,
        // Profile PIN check is part of the pre-session sign-in flow (its own
        // brute-force lockout guards it, like login).
        (&Method::POST, "/api/auth/pin/verify") => true,
        // Quick Connect: the pairing device has no session yet when it initiates
        // and polls (authorize, done by the already-signed-in device, is gated).
        (&Method::POST, "/api/auth/quickconnect/initiate") => true,
        (&Method::GET, "/api/auth/quickconnect/poll") => true,
        // Roster picker for the "who's watching" screen (returns empty unless the
        // publicUserList setting is on, so it leaks nothing by itself).
        (&Method::GET, "/api/users") => true,
        // Invite preview: an invitee opens the link before they have an account.
        (&Method::GET, _) if is_invite_preview(path) => true,
        _ => false,
    }
}

/// `GET /api/invites/:token` (exactly one segment after `/invites/`).
fn is_invite_preview(path: &str) -> bool {
    let Some(rest) = path.strip_prefix("/api/invites/") else {
        return false;
    };
    !rest.is_empty() && !rest.contains('/')
}

/// Routes served to browser tags / the events WebSocket, which can't send a
/// bearer header, so they also accept a media-scoped `?t=` token. All are `GET`.
fn is_media(method: &Method, path: &str) -> bool {
    if method != Method::GET {
        return false;
    }
    if path.starts_with("/api/images/") || path.starts_with("/api/themes/") {
        return true;
    }
    if path == "/api/events" {
        return true;
    }
    // Split into segments: ["", "api", <col>, <id>, <tail>, ...].
    let seg: Vec<&str> = path.split('/').collect();
    // /api/shows/:id/poster
    if seg.len() == 5 && seg[2] == "shows" && seg[4] == "poster" {
        return true;
    }
    if seg.len() >= 5 && seg[2] == "items" {
        let tail = seg[4];
        // /api/items/:id/{stream,storyboard,storyboard.img,poster,card}
        if seg.len() == 5 && matches!(tail, "stream" | "storyboard" | "storyboard.img" | "poster" | "card") {
            return true;
        }
        // /api/items/:id/hls/...
        if tail == "hls" {
            return true;
        }
        if tail == "subtitles" {
            // /api/items/:id/subtitles/:track  (numeric embedded-track WebVTT,
            // requested as `<n>` or `<n>.vtt`). The named JSON endpoints
            // (capabilities/generations/downloaded) fall through to the session
            // requirement.
            if seg.len() == 6 && seg[5].trim_end_matches(".vtt").parse::<u32>().is_ok() {
                return true;
            }
            // /api/items/:id/subtitles/dl/:dl  (downloaded-sub WebVTT for <track>).
            if seg.len() == 7 && seg[5] == "dl" {
                return true;
            }
        }
    }
    false
}

/// Read a single query parameter's raw value. Media tokens are `<uid>.<exp>.<hex>`
/// (URL-safe), so no percent-decoding is needed.
fn query_param(query: Option<&str>, key: &str) -> Option<String> {
    let query = query?;
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        if it.next() == Some(key) {
            return Some(it.next().unwrap_or("").to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_paths() {
        assert!(is_public(&Method::POST, "/api/auth/login"));
        assert!(is_public(&Method::GET, "/api/auth/config"));
        assert!(is_public(&Method::GET, "/api/health"));
        assert!(is_public(&Method::GET, "/api/invites/abc123"));
        assert!(!is_public(&Method::GET, "/api/invites/abc123/extra"));
        assert!(!is_public(&Method::GET, "/api/movies"));
        assert!(!is_public(&Method::POST, "/api/auth/quickconnect/authorize"));
    }

    #[test]
    fn media_paths() {
        assert!(is_media(&Method::GET, "/api/images/abc.webp"));
        assert!(is_media(&Method::GET, "/api/themes/xyz.mp3"));
        assert!(is_media(&Method::GET, "/api/events"));
        assert!(is_media(&Method::GET, "/api/items/ID/stream"));
        assert!(is_media(&Method::GET, "/api/items/ID/hls/copy/0/0/index.m3u8"));
        assert!(is_media(&Method::GET, "/api/items/ID/storyboard.img"));
        assert!(is_media(&Method::GET, "/api/items/ID/poster"));
        assert!(is_media(&Method::GET, "/api/shows/ID/poster"));
        assert!(is_media(&Method::GET, "/api/items/ID/subtitles/2"));
        assert!(is_media(&Method::GET, "/api/items/ID/subtitles/2.vtt"));
        assert!(is_media(&Method::GET, "/api/items/ID/subtitles/dl/xyz"));
        // JSON subtitle endpoints are NOT media (need a session).
        assert!(!is_media(&Method::GET, "/api/items/ID/subtitles/capabilities"));
        assert!(!is_media(&Method::GET, "/api/items/ID/subtitles/generations"));
        assert!(!is_media(&Method::GET, "/api/movies"));
        assert!(!is_media(&Method::POST, "/api/items/ID/stream"));
    }

    #[test]
    fn query_parsing() {
        assert_eq!(query_param(Some("t=abc"), "t").as_deref(), Some("abc"));
        assert_eq!(query_param(Some("a=1&t=abc&b=2"), "t").as_deref(), Some("abc"));
        assert_eq!(query_param(Some("a=1"), "t"), None);
        assert_eq!(query_param(None, "t"), None);
    }
}
