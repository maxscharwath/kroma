//! API surface: route table and JSON helpers.

pub mod card;
pub mod error;
pub mod handlers;
pub mod poster;
pub mod users;
pub mod ws;

use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::state::SharedState;

/// Build the application router with all `/api` routes plus CORS and tracing.
pub fn router(state: SharedState) -> Router {
    let api = Router::new()
        .route("/health", get(handlers::health))
        .route("/libraries", get(handlers::list_libraries))
        .route("/items", get(handlers::list_items))
        .route("/movies", get(handlers::list_movies))
        .route("/shows", get(handlers::list_shows))
        .route("/shows/:id", get(handlers::get_show))
        .route("/shows/:id/poster", get(handlers::show_poster))
        .route("/shows/:id/metadata", get(handlers::show_metadata))
        .route("/items/:id", get(handlers::get_item))
        .route("/items/:id/stream", get(handlers::stream_item))
        .route("/items/:id/hls/index.m3u8", get(handlers::hls_playlist))
        .route("/items/:id/hls/:file", get(handlers::hls_segment))
        .route("/items/:id/poster", get(handlers::item_poster))
        .route("/items/:id/card", get(handlers::item_card))
        .route("/items/:id/metadata", get(handlers::item_metadata))
        .route("/items/:id/subtitles/:track", get(handlers::subtitles))
        .route("/images/:name", get(handlers::image))
        .route("/events", get(ws::events))
        .route("/status", get(handlers::status))
        .route("/logs", get(handlers::logs))
        .route("/scan", post(handlers::rescan))
        // --- accounts / sessions / profiles ---
        .route("/auth/register", post(users::register))
        .route("/auth/login", post(users::login))
        .route("/auth/logout", post(users::logout))
        .route("/auth/me", get(users::me))
        .route("/auth/quickconnect/initiate", post(users::quick_initiate))
        .route("/auth/quickconnect/authorize", post(users::quick_authorize))
        .route("/auth/quickconnect/poll", get(users::quick_poll))
        .route("/users", get(users::list_users))
        .route(
            "/users/avatar",
            post(users::upload_avatar).layer(DefaultBodyLimit::max(users::MAX_AVATAR_BYTES)),
        )
        // --- invitations (registration is invite-only after the owner) ---
        .route("/invites", post(users::create_invite).get(users::list_invites))
        .route(
            "/invites/:token",
            get(users::check_invite).delete(users::delete_invite),
        )
        // --- playback progress / resume ---
        .route("/progress", get(users::list_progress))
        .route("/continue", get(users::continue_watching))
        .route(
            "/progress/:id",
            get(users::get_progress)
                .put(users::save_progress)
                .delete(users::delete_progress),
        );

    Router::new()
        .nest("/api", api)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
