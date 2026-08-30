//! Admin-console types: the members table row, per-user watch stats and the
//! raw history/library aggregates that back the dashboard.

use serde::Serialize;

use crate::accounts::Permission;
use crate::media::Kind;

/// One account as surfaced to the admin "Membres & partage" table. Unlike
/// [`User`] this carries the email, a derived role, last-activity and a live
/// `online` flag (set at request time from the playback registry).
#[derive(Debug, Clone, Serialize)]
pub struct AdminUser {
    pub id: String,
    pub email: String,
    pub username: String,
    #[serde(rename = "avatarUrl", skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    pub permissions: Vec<Permission>,
    pub role: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "lastSeen", skip_serializing_if = "Option::is_none")]
    pub last_seen: Option<String>,
    pub online: bool,
}

/// Aggregated per-user watch stats over a window (the dashboard "Top des
/// utilisateurs" cards).
#[derive(Debug, Clone, Serialize)]
pub struct TopUser {
    pub username: String,
    pub plays: i64,
    #[serde(rename = "watchedMs")]
    pub watched_ms: i64,
    #[serde(rename = "filmsMs")]
    pub films_ms: i64,
    #[serde(rename = "tvMs")]
    pub tv_ms: i64,
}

/// One finished playback, as it is written to the log. Everything the live
/// session knew, because the answer to "who watched this, when, and on what"
/// cannot be reconstructed once the session is reaped.
#[derive(Debug, Clone, Default)]
pub struct PlayRecord {
    pub user_id: Option<String>,
    pub username: Option<String>,
    pub item_id: Option<String>,
    pub kind: String,
    pub title: String,
    pub library: Option<String>,
    pub show_title: Option<String>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub device: Option<String>,
    pub player: Option<String>,
    /// `direct` | `transcode`, as the client reported it while playing.
    pub mode: Option<String>,
    /// `LAN` | `WAN`.
    pub network: Option<String>,
    pub video_label: Option<String>,
    pub audio_label: Option<String>,
    pub started_at: i64,
    pub ended_at: i64,
    pub watched_ms: i64,
}

/// One row of the admin watch log: a finished playback, read back.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayEntry {
    pub id: String,
    pub user_id: Option<String>,
    pub username: String,
    pub item_id: Option<String>,
    pub kind: String,
    pub title: String,
    pub show_title: Option<String>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub device: Option<String>,
    pub player: Option<String>,
    pub mode: Option<String>,
    pub network: Option<String>,
    pub video_label: Option<String>,
    pub audio_label: Option<String>,
    pub started_at: i64,
    pub ended_at: i64,
    pub watched_ms: i64,
}

/// One raw play-history record (used to bucket the weekly "Historique de
/// lecture" chart server-side).
#[derive(Debug, Clone)]
pub struct HistoryRow {
    pub ended_at: i64,
    pub kind: Kind,
    pub watched_ms: i64,
}

/// Per-library aggregate (item count + total bytes on disk) for the storage and
/// libraries admin pages.
#[derive(Debug, Clone)]
pub struct LibraryStat {
    pub id: String,
    pub item_count: i64,
    pub total_bytes: i64,
}
