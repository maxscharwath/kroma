//! Shared HTTP-handler helpers: blocking DB combinators used across the `api`
//! column. Handlers run their SQL on `spawn_blocking` threads via these, mapping
//! any failure to a uniform 500.

use std::net::SocketAddr;

use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use tracing::error;

use crate::api::error::json_error;
use crate::db;

/// Run a blocking DB closure off the async runtime, mapping failures to a 500.
pub(crate) async fn blocking<T, F>(f: F) -> Result<T, Response>
where
    F: FnOnce() -> anyhow::Result<T> + Send + 'static,
    T: Send + 'static,
{
    match tokio::task::spawn_blocking(f).await {
        Ok(Ok(v)) => Ok(v),
        Ok(Err(e)) => {
            error!(error = %e, "database error");
            Err(json_error(StatusCode::INTERNAL_SERVER_ERROR, "internal error"))
        }
        Err(e) => {
            error!(error = %e, "task join error");
            Err(json_error(StatusCode::INTERNAL_SERVER_ERROR, "internal error"))
        }
    }
}

/// Clone the connection pool and run a blocking DB closure off the async runtime.
/// A thin combinator over [`blocking`] that hands the closure its own `Pool`, so
/// handlers don't repeat `let pool = state.db.clone();` before every query.
pub(crate) async fn query<T, F>(pool: &db::Pool, f: F) -> Result<T, Response>
where
    F: FnOnce(db::Pool) -> anyhow::Result<T> + Send + 'static,
    T: Send + 'static,
{
    let pool = pool.clone();
    blocking(move || f(pool)).await
}

/// Best client IP for an incoming request. Cloudflare sets `CF-Connecting-IP` to
/// the true client and overwrites it at the edge, so it can't be spoofed by a
/// client prefilling the header the way the first `X-Forwarded-For` hop can.
/// Preferred when present; falls back to the first `X-Forwarded-For` hop (other
/// reverse proxies, e.g. the Synology one), then the direct socket peer. Shared
/// by playback session accounting and the login brute-force guard.
pub(crate) fn client_ip(headers: &HeaderMap, addr: &SocketAddr) -> String {
    if let Some(cf) = headers.get("cf-connecting-ip").and_then(|v| v.to_str().ok()) {
        let cf = cf.trim();
        if !cf.is_empty() {
            return cf.to_string();
        }
    }
    if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first) = xff.split(',').next() {
            let first = first.trim();
            if !first.is_empty() {
                return first.to_string();
            }
        }
    }
    addr.ip().to_string()
}
