//! API surface: composes each feature module's `routes()` into the `/api`
//! router, then layers CORS, tracing and the SPA fallback. Individual routes
//! live next to their handlers in the submodules, not here.

pub mod admin;
pub mod card;
pub mod dto;
pub mod error;
pub mod playback;
pub mod poster;
pub mod ws;

mod accounts;
mod extract;
mod home;
mod images;
mod invites;
mod media;
mod metadata;
mod people;
mod pin;
mod recommend;
mod search;
mod online_subs;
mod stream;
mod suggest;
mod themes;
mod util;

use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;

use crate::state::SharedState;

/// Build the application router with all `/api` routes plus CORS and tracing.
pub fn router(state: SharedState) -> Router {
    // Each feature module owns its routes via a `routes()` function, so adding a
    // route means editing the module that handles it, not this table. Modules are
    // flat-merged (their paths span prefixes like `/items` and `/shows`); the
    // admin subtree gets its own `/admin` prefix via `nest`.
    let api = Router::new()
        .merge(media::routes())
        .merge(search::routes())
        .merge(people::routes())
        .merge(metadata::routes())
        .merge(images::routes())
        .merge(stream::routes())
        .merge(recommend::routes())
        .merge(suggest::routes())
        .merge(online_subs::routes())
        .merge(themes::routes())
        .merge(home::routes())
        .merge(ws::routes())
        .merge(playback::routes())
        .merge(accounts::routes())
        .merge(pin::routes())
        .merge(invites::routes())
        .nest("/admin", admin::routes());

    let mut app = Router::new().nest("/api", api);

    // Single-binary deploy: serve the built web SPA on the same origin as the API.
    // Static assets are served from disk; any unmatched route falls back to the
    // SPA shell so client-side routing (e.g. /films, /movie/:id) works on refresh.
    // Skipped in dev (no LUMA_WEB_DIR) where the web runs on its own Vite server.
    if let Some(web_dir) = state.config.web_dir.clone() {
        let shell = web_dir.join("_shell.html");
        app = app.fallback_service(ServeDir::new(web_dir).fallback(ServeFile::new(shell)));
    }

    app.layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
