//! Ensure a movie has a trailer catalog, pick a language, start a cache, probe.

mod catalog;

pub use catalog::{
    attach_movie_videos, fill_catalog, fill_matched, maybe_spawn, CATALOG_REV,
};

use kroma_domain::{MediaItem, TrailerClip, VideoStream};

use crate::db::{self, Pool};
use crate::infra::probe;
use crate::infra::trailers::{self, TrailerBytes};

use catalog::ensure_catalog;

#[derive(Debug, Clone)]
pub struct TrailerReady {
    pub language: String,
    pub key: String,
    pub duration_ms: Option<u64>,
    pub container: String,
    pub video: Option<VideoStream>,
}

pub fn info(
    pool: &Pool,
    api_key: Option<&str>,
    locale: &str,
    item_id: &str,
) -> Result<TrailerReady, TrailerError> {
    let item = load_movie(pool, item_id)?;
    let clips = ensure_catalog(pool, api_key, &item)?;
    let clip = trailers::pick(&clips, locale).ok_or(TrailerError::None)?;
    Ok(assumed_ready(clip))
}

pub fn prepare(
    pool: &Pool,
    data_dir: &std::path::Path,
    api_key: Option<&str>,
    locale: &str,
    item_id: &str,
) -> Result<TrailerReady, TrailerError> {
    let item = load_movie(pool, item_id)?;
    let clips = ensure_catalog(pool, api_key, &item)?;
    let clip = trailers::pick(&clips, locale).ok_or(TrailerError::None)?;
    trailers::begin(data_dir, &clip.key).map_err(TrailerError::Cache)?;
    if trailers::is_complete(data_dir, &clip.key) {
        let path = trailers::cached_path(data_dir, &clip.key);
        let probed = probe::probe_file(&path, probe::ffprobe_available());
        return Ok(TrailerReady {
            language: clip.iso_639_1.clone(),
            key: clip.key.clone(),
            duration_ms: probed.duration_ms,
            container: "mp4".into(),
            video: probed.video,
        });
    }
    Ok(assumed_ready(clip))
}

pub fn stream_source(
    pool: &Pool,
    data_dir: &std::path::Path,
    item_id: &str,
    key: &str,
) -> Result<TrailerBytes, TrailerError> {
    if !trailers::is_key_safe(key) {
        return Err(TrailerError::BadKey);
    }
    let item = load_movie(pool, item_id)?;
    let clips = item
        .metadata
        .as_ref()
        .map(|m| m.videos.as_slice())
        .unwrap_or(&[]);
    if !clips.iter().any(|c| c.key == key) {
        return Err(TrailerError::None);
    }
    trailers::open_stream(data_dir, key).map_err(TrailerError::Cache)
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

fn assumed_ready(clip: &TrailerClip) -> TrailerReady {
    TrailerReady {
        language: clip.iso_639_1.clone(),
        key: clip.key.clone(),
        duration_ms: None,
        container: "mp4".into(),
        video: Some(VideoStream {
            codec: "h264".into(),
            width: None,
            height: Some(1080),
            hdr: false,
            bit_depth: None,
        }),
    }
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
