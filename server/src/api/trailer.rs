use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::api::error::json_error;
use crate::api::extract::AuthUser;
use crate::i18n::ReqLocale;
use crate::infra::metrics::ByteSink;
use crate::infra::stream::stream_file;
use crate::model::{User, VideoStream};
use crate::services::settings::trailers_enabled;
use crate::services::trailers::{self, TrailerError, TrailerState};
use crate::state::SharedState;

pub fn public_routes() -> Router<SharedState> {
    Router::new().route("/items/{id}/trailer/stream", get(stream))
}

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/items/{id}/trailer", get(info))
        .route("/items/{id}/trailer/prepare", post(prepare))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrailerBody {
    language: String,
    key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_ms: Option<u64>,
    container: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    video: Option<VideoStream>,
    state: &'static str,
    percent: u8,
}

fn locale(user: &User, header: &str) -> String {
    user.language
        .clone()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| header.to_string())
}

/// A cache failure carries yt-dlp's and ffmpeg's own words, which name signed
/// source URLs and paths under the data dir. The operator gets those in the log;
/// the caller gets one sentence.
fn map_err(err: TrailerError) -> Response {
    match err {
        TrailerError::NotFound => json_error(StatusCode::NOT_FOUND, "item not found"),
        TrailerError::NotMovie | TrailerError::None => {
            json_error(StatusCode::NOT_FOUND, "no trailer")
        }
        TrailerError::Unavailable => json_error(StatusCode::NOT_FOUND, "trailers unavailable"),
        TrailerError::NotCached => json_error(StatusCode::NOT_FOUND, "trailer not prepared"),
        TrailerError::BadKey => json_error(StatusCode::BAD_REQUEST, "invalid trailer key"),
        TrailerError::Cache(msg) => {
            tracing::warn!(error = %msg, "trailer download failed");
            json_error(StatusCode::BAD_GATEWAY, "trailer download failed")
        }
    }
}

async fn run<T: Send + 'static>(
    job: impl FnOnce() -> Result<T, TrailerError> + Send + 'static,
) -> Result<T, Response> {
    tokio::task::spawn_blocking(job)
        .await
        .map_err(|_| json_error(StatusCode::INTERNAL_SERVER_ERROR, "internal error"))?
        .map_err(map_err)
}

fn body(ready: trailers::TrailerReady) -> TrailerBody {
    TrailerBody {
        language: ready.language,
        key: ready.key,
        duration_ms: ready.duration_ms,
        container: ready.container,
        video: ready.video,
        state: match ready.state {
            TrailerState::Ready => "ready",
            TrailerState::Preparing => "preparing",
        },
        percent: ready.percent,
    }
}

async fn info(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    ReqLocale(header): ReqLocale,
    Path(id): Path<String>,
) -> Result<Json<TrailerBody>, Response> {
    if !trailers_enabled(&state.settings) {
        return Err(json_error(StatusCode::NOT_FOUND, "trailers disabled"));
    }
    let locale = locale(&user, header);
    let api_key = state.config.tmdb_api_key.clone();
    let data_dir = state.config.data_dir.clone();
    let pool = state.db.clone();
    let ready =
        run(move || trailers::info(&pool, &data_dir, api_key.as_deref(), &locale, &id)).await?;
    Ok(Json(body(ready)))
}

async fn prepare(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    ReqLocale(header): ReqLocale,
    Path(id): Path<String>,
) -> Result<Json<TrailerBody>, Response> {
    if !trailers_enabled(&state.settings) {
        return Err(json_error(StatusCode::NOT_FOUND, "trailers disabled"));
    }
    let locale = locale(&user, header);
    let api_key = state.config.tmdb_api_key.clone();
    let data_dir = state.config.data_dir.clone();
    let pool = state.db.clone();
    let ready =
        run(move || trailers::prepare(&pool, &data_dir, api_key.as_deref(), &locale, &id)).await?;
    Ok(Json(body(ready)))
}

#[derive(Deserialize)]
struct StreamQuery {
    key: String,
}

/// Serves the finished copy only. Preparing one is `prepare`'s job, behind auth:
/// this route reads bytes that already exist and starts no process.
async fn stream(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    Query(q): Query<StreamQuery>,
    headers: HeaderMap,
) -> Response {
    if !trailers_enabled(&state.settings) {
        return json_error(StatusCode::NOT_FOUND, "trailers disabled");
    }
    let data_dir = state.config.data_dir.clone();
    let pool = state.db.clone();
    match run(move || trailers::stream_source(&pool, &data_dir, &id, &q.key)).await {
        Ok(path) => stream_file(&path, &headers, ByteSink::none()).await,
        Err(resp) => resp,
    }
}
