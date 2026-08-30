//! Analytics: per-user watch aggregates, weekly films-vs-TV history buckets, and
//! the top-line overview counts for the users page.

use axum::extract::{Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::api::extract::AuthUser;
use crate::api::util::query;
use crate::db;
use crate::state::SharedState;
use axum::routing::get;
use axum::Router;

/// Analytics. Paths are relative to the `/api/admin` nest.
pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/stats/top-users", get(top_users))
        .route("/stats/history", get(history))
        .route("/stats/overview", get(overview))
        .route("/stats/plays", get(plays))
}

fn now_unix() -> i64 {
    time::OffsetDateTime::now_utc().unix_timestamp()
}

#[derive(Debug, Deserialize)]
pub struct DaysQuery {
    #[serde(default)]
    pub days: Option<i64>,
}

/// One page of the watch log. `user` narrows it to one account.
#[derive(Debug, Deserialize)]
pub struct PlaysQuery {
    #[serde(default)]
    pub days: Option<i64>,
    #[serde(default)]
    pub user: Option<String>,
    #[serde(default)]
    pub limit: Option<usize>,
    #[serde(default)]
    pub offset: Option<usize>,
}

/// `GET /api/admin/stats/plays?days=30&user=&limit=50&offset=0` → who watched
/// what, when, and on which device, newest first.
pub async fn plays(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    Query(q): Query<PlaysQuery>,
) -> Result<Response, Response> {
    super::require_any_admin(&user)?;
    let days = q.days.unwrap_or(30).clamp(1, 3650);
    let since = now_unix() - days * 86_400;
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let offset = q.offset.unwrap_or(0).min(100_000);
    let who = q.user.filter(|u| !u.is_empty());
    let (entries, total) = query(&state.db, move |pool| {
        let who = who.as_deref();
        Ok((
            db::plays(&pool, since, who, limit, offset)?,
            db::plays_count(&pool, since, who)?,
        ))
    })
    .await?;
    Ok(Json(json!({ "plays": entries, "total": total })).into_response())
}

/// `GET /api/admin/stats/top-users?days=7` → per-user watch aggregates.
pub async fn top_users(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    Query(q): Query<DaysQuery>,
) -> Result<Response, Response> {
    super::require_any_admin(&user)?;
    let days = q.days.unwrap_or(7).clamp(1, 365);
    let since = now_unix() - days * 86_400;
    let users = query(&state.db, move |pool| db::top_users(&pool, since, 12)).await?;
    Ok(Json(json!({ "users": users })).into_response())
}

/// `GET /api/admin/stats/history?days=28` → weekly films-vs-TV watch buckets.
pub async fn history(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
    Query(q): Query<DaysQuery>,
) -> Result<Response, Response> {
    super::require_any_admin(&user)?;
    let days = q.days.unwrap_or(28).clamp(7, 365);
    let now = now_unix();
    let since = now - days * 86_400;
    let rows = query(&state.db, move |pool| db::history_since(&pool, since)).await?;

    // Weekly buckets covering [since, now].
    let week = 7 * 86_400;
    let buckets = ((days + 6) / 7).max(1);
    let mut films = vec![0i64; buckets as usize];
    let mut tv = vec![0i64; buckets as usize];
    for r in &rows {
        let idx = (((r.ended_at - since) / week).clamp(0, buckets - 1)) as usize;
        match r.kind {
            crate::model::Kind::Movie => films[idx] += r.watched_ms,
            _ => tv[idx] += r.watched_ms,
        }
    }
    let out: Vec<crate::api::dto::HistoryBucket> = (0..buckets as usize)
        .map(|i| {
            let start = since + (i as i64) * week;
            crate::api::dto::HistoryBucket {
                label: date_range_label(start, (start + week).min(now)),
                films_ms: films[i],
                tv_ms: tv[i],
            }
        })
        .collect();
    Ok(Json(crate::api::dto::HistoryStats {
        total_films_ms: films.iter().sum::<i64>(),
        total_tv_ms: tv.iter().sum::<i64>(),
        buckets: out,
    })
    .into_response())
}

/// `GET /api/admin/stats/overview` → top-line counts for the users page.
pub async fn overview(
    State(state): State<SharedState>,
    AuthUser(user): AuthUser,
) -> Result<Response, Response> {
    super::require_any_admin(&user)?;
    let (libraries, items, shows, users, invites) = query(&state.db, move |pool| {
        let (libraries, items, shows) = db::counts(&pool)?;
        let users = db::admin_users(&pool)?;
        let invites = db::list_invites(&pool)?.len();
        Ok((libraries, items, shows, users, invites))
    })
    .await?;
    let online = users
        .iter()
        .filter(|u| state.playback.user_online(&u.id))
        .count();
    Ok(Json(crate::api::dto::AdminOverview {
        users: users.len(),
        online,
        invites,
        items,
        shows,
        libraries,
    })
    .into_response())
}

// "DD/MM–DD/MM" label for a weekly bucket.
fn date_range_label(start: i64, end: i64) -> String {
    let fmt = |ts: i64| {
        time::OffsetDateTime::from_unix_timestamp(ts)
            .map(|d| format!("{:02}/{:02}", d.day(), d.month() as u8))
            .unwrap_or_else(|_| "??".into())
    };
    format!("{}–{}", fmt(start), fmt(end))
}
