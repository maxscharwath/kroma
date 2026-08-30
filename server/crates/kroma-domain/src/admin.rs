//! Admin-console types: the members table row, per-user watch stats and the
//! raw history/library aggregates that back the dashboard.

use serde::Serialize;

use crate::accounts::Permission;

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

/// KROMA holds films and television today; the other two are reported as zeroes
/// so a client draws an honest empty row rather than hiding a kind it has never
/// seen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WatchKind {
    Movie,
    Tv,
    Music,
    Photo,
}

impl WatchKind {
    pub const ALL: [WatchKind; 4] = [
        WatchKind::Movie,
        WatchKind::Tv,
        WatchKind::Music,
        WatchKind::Photo,
    ];

    /// The kind a logged play counts under. KROMA's `episode` and `video` both
    /// land on `tv`, and anything unrecognised counts as a film.
    pub fn from_media_kind(kind: &str) -> WatchKind {
        match kind {
            "episode" | "video" | "tv" => WatchKind::Tv,
            "music" => WatchKind::Music,
            "photo" => WatchKind::Photo,
            _ => WatchKind::Movie,
        }
    }

    pub fn parse(value: &str) -> Option<WatchKind> {
        match value {
            "movie" => Some(WatchKind::Movie),
            "tv" => Some(WatchKind::Tv),
            "music" => Some(WatchKind::Music),
            "photo" => Some(WatchKind::Photo),
            _ => None,
        }
    }
}

/// Milliseconds watched per kind.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct WatchTotals {
    pub movie: i64,
    pub tv: i64,
    pub music: i64,
    pub photo: i64,
}

impl WatchTotals {
    pub fn add(&mut self, kind: WatchKind, ms: i64) {
        match kind {
            WatchKind::Movie => self.movie += ms,
            WatchKind::Tv => self.tv += ms,
            WatchKind::Music => self.music += ms,
            WatchKind::Photo => self.photo += ms,
        }
    }

    pub fn get(&self, kind: WatchKind) -> i64 {
        match kind {
            WatchKind::Movie => self.movie,
            WatchKind::Tv => self.tv,
            WatchKind::Music => self.music,
            WatchKind::Photo => self.photo,
        }
    }
}

/// Aggregated per-user watch stats over a window (the dashboard "Top des
/// utilisateurs" cards). `films_ms` and `tv_ms` are the two kinds the card read
/// before `by_kind` carried all four; the wire keeps both.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopUser {
    pub username: String,
    pub user_id: Option<String>,
    pub avatar_url: Option<String>,
    pub plays: i64,
    pub watched_ms: i64,
    pub films_ms: i64,
    pub tv_ms: i64,
    pub by_kind: WatchTotals,
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
    pub mode: Option<String>,
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
    pub library: Option<String>,
    pub started_at: i64,
    pub ended_at: i64,
    pub watched_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct HistoryLibrary {
    pub id: String,
    pub name: String,
}

/// One raw play-history record, bucketed server-side into the "Historique de
/// lecture" chart.
#[derive(Debug, Clone)]
pub struct HistoryRow {
    pub ended_at: i64,
    pub kind: WatchKind,
    pub watched_ms: i64,
}

/// `viewers` counts distinct accounts. A series is one entry, not one per
/// episode.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MostWatchedEntry {
    pub item_id: String,
    pub title: String,
    pub kind: WatchKind,
    pub show_id: Option<String>,
    pub year: Option<u32>,
    pub plays: i64,
    pub viewers: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct MostWatchedColumn {
    pub kind: WatchKind,
    pub entries: Vec<MostWatchedEntry>,
}

/// Per-library aggregate (item count + total bytes on disk) for the storage and
/// libraries admin pages.
#[derive(Debug, Clone)]
pub struct LibraryStat {
    pub id: String,
    pub item_count: i64,
    pub total_bytes: i64,
}
