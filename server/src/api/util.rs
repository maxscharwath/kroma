//! Shared HTTP-handler helpers: blocking DB combinators used across the `api`
//! column. Handlers run their SQL on `spawn_blocking` threads via these, mapping
//! any failure to a uniform 500.

use axum::http::StatusCode;
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
