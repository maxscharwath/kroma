//! Ensure a movie has a trailer catalog, pick a language, start the local copy.

mod catalog;

pub use catalog::{attach_movie_videos, fill_catalog, fill_matched, maybe_spawn, CATALOG_REV};

use std::path::{Path, PathBuf};
use std::time::Duration;

use kroma_domain::{MediaItem, TrailerClip, VideoStream};

use crate::db::{self, Pool};
use crate::infra::trailers::{self, ClipMeta};

use catalog::ensure_catalog;

/// How long `prepare` waits for the source to report the clip's length. yt-dlp
/// prints it before the first byte, so this is not the download.
const META_WAIT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrailerState {
    Ready,
    Preparing,
}

#[derive(Debug, Clone)]
pub struct TrailerReady {
    pub language: String,
    pub key: String,
    pub duration_ms: Option<u64>,
    pub container: String,
    pub video: Option<VideoStream>,
    pub state: TrailerState,
    pub percent: u8,
}

/// Which clip this viewer would get, and whether it is already here. Starts
/// nothing: opening a fiche must not fetch anything.
pub fn info(
    pool: &Pool,
    data_dir: &Path,
    api_key: Option<&str>,
    locale: &str,
    item_id: &str,
) -> Result<TrailerReady, TrailerError> {
    let clip = pick_clip(pool, api_key, locale, item_id)?;
    let Some(status) = trailers::peek(data_dir, &clip.key).map(|job| job.status()) else {
        return Ok(waiting(&clip, 0));
    };
    match (status.finished, status.failed.is_none(), status.meta) {
        (true, true, Some(meta)) => Ok(ready(&clip, &meta)),
        _ => Ok(waiting(&clip, status.percent)),
    }
}

/// Picks the clip and starts the copy, answering as soon as the length is known
/// so the player has something to size its scrub bar against.
pub fn prepare(
    pool: &Pool,
    data_dir: &Path,
    api_key: Option<&str>,
    locale: &str,
    item_id: &str,
) -> Result<TrailerReady, TrailerError> {
    let clip = pick_clip(pool, api_key, locale, item_id)?;
    let job = trailers::begin(data_dir, &clip.key).map_err(TrailerError::Cache)?;
    let status = job.wait_meta(META_WAIT);
    if let Some(err) = status.failed {
        return Err(TrailerError::Cache(err));
    }
    let meta = status.meta.unwrap_or_default();
    if status.finished {
        return Ok(ready(&clip, &meta));
    }
    Ok(TrailerReady {
        duration_ms: meta.duration_ms,
        video: video_of(&meta),
        ..waiting(&clip, status.percent)
    })
}

/// The finished file for a key this item's own catalog carries.
pub fn stream_source(
    pool: &Pool,
    data_dir: &Path,
    item_id: &str,
    key: &str,
) -> Result<PathBuf, TrailerError> {
    if !trailers::is_key_safe(key) {
        return Err(TrailerError::BadKey);
    }
    let item = load_movie(pool, item_id)?;
    let known = item
        .metadata
        .as_ref()
        .is_some_and(|m| m.videos.iter().any(|c| c.key == key));
    if !known {
        return Err(TrailerError::None);
    }
    trailers::open_stream(data_dir, key).ok_or(TrailerError::NotCached)
}

fn pick_clip(
    pool: &Pool,
    api_key: Option<&str>,
    locale: &str,
    item_id: &str,
) -> Result<TrailerClip, TrailerError> {
    let item = load_movie(pool, item_id)?;
    let clips = ensure_catalog(pool, api_key, &item)?;
    trailers::pick(&clips, locale).cloned().ok_or(TrailerError::None)
}

fn load_movie(pool: &Pool, item_id: &str) -> Result<MediaItem, TrailerError> {
    let item = db::get_item(pool, item_id)
        .map_err(|_| TrailerError::Unavailable)?
        .ok_or(TrailerError::NotFound)?;
    if item.kind != kroma_domain::Kind::Movie {
        return Err(TrailerError::NotMovie);
    }
    Ok(item)
}

fn ready(clip: &TrailerClip, meta: &ClipMeta) -> TrailerReady {
    TrailerReady {
        language: clip.iso_639_1.clone(),
        key: clip.key.clone(),
        duration_ms: meta.duration_ms,
        container: "mp4".into(),
        video: video_of(meta),
        state: TrailerState::Ready,
        percent: 100,
    }
}

fn waiting(clip: &TrailerClip, percent: u8) -> TrailerReady {
    TrailerReady {
        language: clip.iso_639_1.clone(),
        key: clip.key.clone(),
        duration_ms: None,
        container: "mp4".into(),
        video: None,
        state: TrailerState::Preparing,
        percent,
    }
}

fn video_of(meta: &ClipMeta) -> Option<VideoStream> {
    let codec = meta.codec.clone()?;
    Some(VideoStream {
        codec,
        width: meta.width,
        height: meta.height,
        hdr: false,
        bit_depth: None,
    })
}

#[derive(Debug)]
pub enum TrailerError {
    NotFound,
    NotMovie,
    None,
    Unavailable,
    NotCached,
    BadKey,
    Cache(String),
}
