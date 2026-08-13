//! The requested title as TMDB describes it, joined with the request's own
//! ledger and the library. Wider than [`crate::services::requests`]'s wanted
//! rows on purpose: an admin has to see the seasons and episodes the request
//! left out to decide whether to go and get them, and has to see what the
//! library already holds of each one to decide whether it is worth replacing.
//!
//! Synchronous and does network/DB work: call it from a blocking context.

use std::collections::HashMap;

use anyhow::{anyhow, Result};

use kroma_module_host::HostCtx;

use crate::db;
use crate::infra::metadata::{self, discover};
use crate::model::{
    LedgerEpisode, LedgerSeason, MediaRequest, RequestCoverage, RequestKind, RequestLedgerView,
    SeasonLedgerView, VideoStream,
};
use crate::services::requests::today_ymd;

type OnDisk = HashMap<(u32, u32), db::EpisodeOnDisk>;

/// The request's seasons, tallied against the ledger and the library. Costs one
/// TMDB detail call; the per-episode rows are fetched a season at a time by
/// [`season_ledger`].
pub fn ledger<S: HostCtx>(state: &S, request_id: &str) -> Result<RequestLedgerView> {
    let req = load_request(state, request_id)?;
    let detail = fetch_detail(state, &req)?;
    let conn = state.db().get()?;
    let wanted = db::wanted_for_request(&conn, &req.id)?;
    let present = on_disk(&conn, &req)?;
    let local_id = match req.kind {
        RequestKind::Movie => db::movie_item_by_tmdb(&conn, req.tmdb_id)?,
        RequestKind::Show => db::show_by_tmdb(&conn, req.tmdb_id)?,
    };
    drop(conn);

    let seasons = detail
        .seasons
        .iter()
        .map(|s| LedgerSeason {
            season: s.season,
            name: s.name.clone(),
            air_date: s.air_date.clone(),
            episode_count: s.episode_count,
            requested: wanted.iter().filter(|w| w.season == Some(s.season)).count() as u32,
            on_disk: present.keys().filter(|(season, _)| *season == s.season).count() as u32,
        })
        .collect();

    Ok(RequestLedgerView {
        kind: req.kind,
        tmdb_id: req.tmdb_id,
        title: req.title.clone(),
        year: req.year,
        today: today_ymd(),
        coverage: RequestCoverage {
            seasons: req.seasons.clone(),
            episodes: req.episodes.clone(),
        },
        poster_url: detail.poster_url.clone(),
        backdrop_url: detail.backdrop_url.clone(),
        overview: detail.overview.clone(),
        seasons,
        on_disk: req.kind == RequestKind::Movie && local_id.is_some(),
        local_id,
        air_date: detail.available_date.clone(),
    })
}

/// One season's episodes, from TMDB, flagged with what the request covers and
/// what the library holds.
pub fn season_ledger<S: HostCtx>(
    state: &S,
    request_id: &str,
    season: u32,
) -> Result<SeasonLedgerView> {
    let req = load_request(state, request_id)?;
    if req.kind != RequestKind::Show {
        return Ok(SeasonLedgerView { season, episodes: Vec::new() });
    }
    let conn = state.db().get()?;
    let wanted = db::wanted_for_request(&conn, &req.id)?;
    let present = on_disk(&conn, &req)?;
    drop(conn);

    let episodes = season_episodes(state, req.tmdb_id, season)?
        .into_iter()
        .map(|ep| {
            let row = wanted
                .iter()
                .find(|w| w.season == Some(season) && w.episode == Some(ep.episode));
            let file = present.get(&(season, ep.episode));
            LedgerEpisode {
                season,
                episode: ep.episode,
                name: ep.name,
                overview: ep.overview,
                air_date: ep.air_date,
                still_url: ep.still_url,
                rating: ep.rating,
                on_disk: file.is_some(),
                wanted_id: row.map(|w| w.id.clone()),
                wanted_status: row.map(|w| w.status.clone()),
                item_id: file.map(|f| f.item_id.clone()),
                video: file.and_then(video_of),
                duration_ms: file.and_then(|f| f.duration_ms),
            }
        })
        .collect();
    Ok(SeasonLedgerView { season, episodes })
}

/// The wanted rows a season WOULD get, for a season the request does not cover.
/// Persists nothing: it exists so an interactive search can be aimed at a season
/// outside the request, which is most of what an admin looks for.
pub fn preview_season_rows<S: HostCtx>(
    state: &S,
    req: &MediaRequest,
    season: u32,
) -> Result<Vec<db::WantedRow>> {
    if req.kind != RequestKind::Show {
        return Ok(Vec::new());
    }
    let detail = fetch_detail(state, req)?;
    Ok(season_episodes(state, req.tmdb_id, season)?
        .into_iter()
        .map(|ep| db::WantedRow {
            id: format!("preview|{}|s{season:02}e{:03}", req.id, ep.episode),
            request_id: req.id.clone(),
            kind: "episode".into(),
            tmdb_id: req.tmdb_id,
            imdb_id: detail.imdb_id.clone(),
            title: req.title.clone(),
            year: req.year,
            season: Some(season),
            episode: Some(ep.episode),
            air_date: ep.air_date,
            status: "wanted".into(),
            last_search_at: None,
        })
        .collect())
}

fn video_of(file: &db::EpisodeOnDisk) -> Option<VideoStream> {
    file.codec.as_ref().map(|codec| VideoStream {
        codec: codec.clone(),
        width: file.width,
        height: file.height,
        hdr: file.hdr,
        bit_depth: file.bit_depth,
    })
}

fn load_request<S: HostCtx>(state: &S, request_id: &str) -> Result<MediaRequest> {
    let conn = state.db().get()?;
    db::get_request(&conn, request_id)?.ok_or_else(|| anyhow!("request not found"))
}

fn fetch_detail<S: HostCtx>(state: &S, req: &MediaRequest) -> Result<discover::DiscoverRawDetail> {
    let key = tmdb_key(state)?;
    discover::detail(&key, &state.metadata_language(), req.kind, req.tmdb_id)
        .map_err(|()| anyhow!("TMDB lookup failed"))?
        .ok_or_else(|| anyhow!("title not found on TMDB"))
}

fn season_episodes<S: HostCtx>(
    state: &S,
    tmdb_id: u64,
    season: u32,
) -> Result<Vec<metadata::EpisodeArt>> {
    let key = tmdb_key(state)?;
    Ok(metadata::season_episodes(&key, &state.metadata_language(), tmdb_id, season).episodes)
}

fn tmdb_key<S: HostCtx>(state: &S) -> Result<String> {
    state.tmdb_api_key().ok_or_else(|| anyhow!("TMDB is not configured"))
}

fn on_disk(conn: &db::PooledConn, req: &MediaRequest) -> Result<OnDisk> {
    if req.kind != RequestKind::Show {
        return Ok(OnDisk::new());
    }
    let Some(show_id) = db::show_by_tmdb(conn, req.tmdb_id)? else {
        return Ok(OnDisk::new());
    };
    Ok(db::episodes_on_disk(conn, &show_id)?
        .into_iter()
        .map(|row| ((row.season, row.episode), row))
        .collect())
}
