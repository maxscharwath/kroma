//! On-demand HLS **audio-transcode** sessions.
//!
//! LUMA's streaming policy is direct-play: [`crate::stream`] serves original
//! bytes and the server never re-encodes *video*. The one exception is audio.
//! HEVC files routinely carry AC3/EAC3/DTS/TrueHD tracks that browsers
//! (Chrome/Firefox) refuse to decode for licensing reasons, which yields
//! video-but-no-sound. For those clients we expose an HLS variant that *copies*
//! the video stream untouched and transcodes only the audio to stereo AAC —
//! cheap (no video re-encode, runs many× realtime) and surgical.
//!
//! A session is one running `ffmpeg` writing fragmented-MP4 HLS segments into a
//! per-item directory under `<data>/transcode/`. The playlist is served as it
//! grows (`event` type); idle sessions are reaped after [`IDLE_TIMEOUT`].

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio::time::sleep;
use tracing::{info, warn};

/// HLS target segment duration handed to ffmpeg.
const SEGMENT_SECONDS: &str = "6";
/// Tear a session down after this long without a request.
const IDLE_TIMEOUT: Duration = Duration::from_secs(120);
/// How often the reaper sweeps for idle sessions.
const REAP_INTERVAL: Duration = Duration::from_secs(30);
/// Give ffmpeg this long to emit a playlist with a first playable segment.
const PLAYLIST_WAIT: Duration = Duration::from_secs(15);
/// A freshly-requested segment may not be flushed yet; poll for this long.
const SEGMENT_WAIT: Duration = Duration::from_secs(8);

/// One live transcode: the working directory plus the ffmpeg child to kill.
struct Session {
    dir: PathBuf,
    child: Mutex<Child>,
    last_access: Mutex<Instant>,
}

impl Session {
    async fn touch(&self) {
        *self.last_access.lock().await = Instant::now();
    }
}

/// Process-wide registry of HLS audio-transcode sessions, keyed by item id.
#[derive(Clone)]
pub struct Sessions {
    root: PathBuf,
    inner: Arc<Mutex<HashMap<String, Arc<Session>>>>,
}

impl Sessions {
    /// Create the registry, wiping any stale `<data>/transcode/` left by a crash.
    pub fn new(data_dir: &Path) -> Self {
        let root = data_dir.join("transcode");
        let _ = std::fs::remove_dir_all(&root);
        let _ = std::fs::create_dir_all(&root);
        Sessions {
            root,
            inner: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start (or reuse) a session for `id` and return the live playlist bytes.
    /// Waits up to [`PLAYLIST_WAIT`] for ffmpeg to list a first segment so the
    /// client can begin playback immediately. `None` means ffmpeg never produced
    /// output (missing binary, unreadable input, …).
    pub async fn playlist(&self, id: &str, input: &Path) -> Option<Vec<u8>> {
        let session = match self.ensure(id, input).await {
            Ok(s) => s,
            Err(e) => {
                warn!(error = %e, item = %id, "failed to start audio transcode");
                return None;
            }
        };
        let path = session.dir.join("index.m3u8");
        let deadline = Instant::now() + PLAYLIST_WAIT;
        loop {
            if let Ok(bytes) = tokio::fs::read(&path).await {
                // Wait until at least one segment is listed (`#EXTINF`), otherwise
                // hls.js would load an empty playlist and stall.
                if contains(&bytes, b"#EXTINF") {
                    return Some(bytes);
                }
            }
            if Instant::now() >= deadline {
                // Return whatever exists; a header-only playlist is better than a
                // hard error and the client will refresh.
                return tokio::fs::read(&path).await.ok();
            }
            sleep(Duration::from_millis(120)).await;
        }
    }

    /// Serve a file (init fragment, segment, or refreshed playlist) from a live
    /// session. Returns the bytes plus a content-type. `None` if the session is
    /// gone, the name is unsafe, or the file never appears.
    pub async fn file(&self, id: &str, name: &str) -> Option<(Vec<u8>, &'static str)> {
        if !is_safe_name(name) {
            return None;
        }
        let session = {
            let map = self.inner.lock().await;
            map.get(id).cloned()
        }?;
        session.touch().await;

        let path = session.dir.join(name);
        let deadline = Instant::now() + SEGMENT_WAIT;
        loop {
            if let Ok(bytes) = tokio::fs::read(&path).await {
                return Some((bytes, content_type(name)));
            }
            if Instant::now() >= deadline {
                return None;
            }
            sleep(Duration::from_millis(100)).await;
        }
    }

    /// Look up an existing session or spawn ffmpeg for a new one.
    async fn ensure(&self, id: &str, input: &Path) -> std::io::Result<Arc<Session>> {
        let mut map = self.inner.lock().await;
        if let Some(s) = map.get(id) {
            s.touch().await;
            return Ok(s.clone());
        }
        let dir = self.root.join(safe_dir(id));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir)?;
        let child = spawn_ffmpeg(input, &dir)?;
        info!(item = %id, dir = %dir.display(), "started HLS audio transcode (video copy + AAC stereo)");
        let session = Arc::new(Session {
            dir,
            child: Mutex::new(child),
            last_access: Mutex::new(Instant::now()),
        });
        map.insert(id.to_string(), session.clone());
        Ok(session)
    }

    /// Background task: kill + clean up sessions idle longer than [`IDLE_TIMEOUT`].
    pub fn spawn_reaper(&self) {
        let inner = self.inner.clone();
        tokio::spawn(async move {
            loop {
                sleep(REAP_INTERVAL).await;
                let now = Instant::now();
                let mut map = inner.lock().await;
                let mut dead = Vec::new();
                for (id, s) in map.iter() {
                    if now.duration_since(*s.last_access.lock().await) > IDLE_TIMEOUT {
                        dead.push(id.clone());
                    }
                }
                for id in dead {
                    if let Some(s) = map.remove(&id) {
                        let _ = s.child.lock().await.start_kill();
                        let _ = std::fs::remove_dir_all(&s.dir);
                        info!(item = %id, "reaped idle transcode session");
                    }
                }
            }
        });
    }
}

/// Build the ffmpeg HLS command: copy the first video stream verbatim, transcode
/// the first audio stream to stereo AAC, emit fragmented-MP4 segments.
fn spawn_ffmpeg(input: &Path, dir: &Path) -> std::io::Result<Child> {
    Command::new("ffmpeg")
        .args(["-v", "error", "-nostdin", "-i"])
        .arg(input)
        // First video + first audio; ignore extra streams (subs/data) the HLS
        // muxer can't carry in fMP4.
        .args(["-map", "0:v:0", "-map", "0:a:0"])
        .args(["-c:v", "copy"])
        .args(["-c:a", "aac", "-ac", "2", "-b:a", "192k"])
        .args(["-f", "hls", "-hls_time", SEGMENT_SECONDS])
        .args(["-hls_playlist_type", "event"])
        .args(["-hls_segment_type", "fmp4"])
        .args(["-hls_fmp4_init_filename", "init.mp4"])
        .arg("-hls_segment_filename")
        .arg(dir.join("seg_%05d.m4s"))
        // `temp_file` → write to `.tmp` then atomically rename, so we never serve
        // a half-written segment/playlist.
        .args(["-hls_flags", "independent_segments+temp_file"])
        .arg(dir.join("index.m3u8"))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
}

/// Map an HLS file name to its content-type.
fn content_type(name: &str) -> &'static str {
    if name.ends_with(".m3u8") {
        "application/vnd.apple.mpegurl"
    } else if name.ends_with(".mp4") {
        "video/mp4"
    } else {
        // fMP4 media segments (.m4s)
        "video/iso.segment"
    }
}

/// Reject path traversal and anything but a plain segment/playlist file name.
fn is_safe_name(name: &str) -> bool {
    !name.is_empty()
        && !name.contains("..")
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
}

/// A filesystem-safe directory name derived from an item id.
fn safe_dir(id: &str) -> String {
    id.chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '-' | '_') { c } else { '_' })
        .collect()
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}
