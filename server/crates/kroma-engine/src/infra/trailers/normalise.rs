use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::infra::probe::{self, ProbeResult};

use super::source::{audio_codec, video_codec, ClipMeta};

/// Below this a file is a stub, not a clip: an empty mux, a truncated fragment.
pub const MIN_BYTES: u64 = 32 * 1024;

const TRANSCODE_SECS: u64 = 600;

/// Moves yt-dlp's result to `out`, re-encoding first if the format ladder had to
/// fall back to a codec a television cannot decode. The file at `out` is always
/// H.264/AAC with its moov up front.
pub fn into_place(work: &Path, out: &Path) -> Result<(), String> {
    let produced = produced_file(work)?;
    if file_len(&produced) < MIN_BYTES {
        return Err("downloaded trailer was empty".into());
    }
    let path = if plays_everywhere(&measure(&produced)) {
        produced
    } else {
        transcode(&produced, &work.join("normalised.mp4"))?
    };
    if file_len(&path) < MIN_BYTES {
        return Err("downloaded trailer was empty".into());
    }
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("could not create trailers dir: {e}"))?;
    }
    move_file(&path, out)
}

/// The clip as the finished file itself reports it, which outranks anything the
/// source claimed.
pub fn measure(path: &Path) -> ClipMeta {
    let probed: ProbeResult = probe::probe_file(path, probe::ffprobe_available());
    ClipMeta {
        duration_ms: probed.duration_ms,
        width: probed.video.as_ref().and_then(|v| v.width),
        height: probed.video.as_ref().and_then(|v| v.height),
        codec: probed.video.as_ref().map(|v| video_codec(&v.codec)),
        audio_codec: probed.audio.as_ref().map(|a| audio_codec(&a.codec)),
        bytes: Some(file_len(path)).filter(|&n| n > 0),
    }
}

pub fn file_len(path: &Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

fn plays_everywhere(meta: &ClipMeta) -> bool {
    let video_ok = meta.codec.as_deref() == Some("h264");
    let audio_ok = meta.audio_codec.as_deref().is_none_or(|c| c == "aac");
    video_ok && audio_ok
}

fn produced_file(work: &Path) -> Result<PathBuf, String> {
    let merged = work.join("clip.mp4");
    if merged.exists() {
        return Ok(merged);
    }
    let mut best: Option<(u64, PathBuf)> = None;
    for entry in std::fs::read_dir(work).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "part") || !path.is_file() {
            continue;
        }
        let len = file_len(&path);
        if best.as_ref().is_none_or(|(seen, _)| len > *seen) {
            best = Some((len, path));
        }
    }
    best.map(|(_, path)| path).ok_or_else(|| "yt-dlp wrote no file".into())
}

fn transcode(input: &Path, out: &Path) -> Result<PathBuf, String> {
    let mut child = Command::new("ffmpeg")
        .args(["-nostdin", "-hide_banner", "-loglevel", "error", "-i"])
        .arg(input)
        .args([
            "-vf",
            "scale=-2:min(1080\\,ih)",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            "-y",
        ])
        .arg(out)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("could not start ffmpeg (is it installed and on PATH?): {e}"))?;

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(TRANSCODE_SECS);
    loop {
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(status) if status.success() => return Ok(out.to_path_buf()),
            Some(status) => {
                return Err(format!(
                    "ffmpeg {}",
                    status.code().map_or_else(|| "killed".into(), |c| format!("exit {c}"))
                ))
            }
            None if std::time::Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("trailer re-encode timed out after {TRANSCODE_SECS}s"));
            }
            None => std::thread::sleep(std::time::Duration::from_millis(100)),
        }
    }
}

/// Rename first: the scratch dir and the cache are usually one filesystem. A
/// container that mounts them separately falls back to a copy.
fn move_file(from: &Path, to: &Path) -> Result<(), String> {
    if std::fs::rename(from, to).is_ok() {
        return Ok(());
    }
    std::fs::copy(from, to)
        .map(|_| {
            let _ = std::fs::remove_file(from);
        })
        .map_err(|e| format!("could not move trailer into place: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn h264_aac() -> ClipMeta {
        ClipMeta {
            codec: Some("h264".into()),
            audio_codec: Some("aac".into()),
            ..ClipMeta::default()
        }
    }

    #[test]
    fn h264_with_aac_is_kept_as_it_landed() {
        assert!(plays_everywhere(&h264_aac()));
    }

    #[test]
    fn a_silent_h264_clip_still_needs_no_re_encode() {
        assert!(plays_everywhere(&ClipMeta { audio_codec: None, ..h264_aac() }));
    }

    #[test]
    fn vp9_or_opus_is_re_encoded_before_a_television_ever_sees_it() {
        assert!(!plays_everywhere(&ClipMeta { codec: Some("vp9".into()), ..h264_aac() }));
        assert!(!plays_everywhere(&ClipMeta { codec: Some("av1".into()), ..h264_aac() }));
        assert!(!plays_everywhere(&ClipMeta {
            audio_codec: Some("opus".into()),
            ..h264_aac()
        }));
    }

    #[test]
    fn the_merged_file_is_preferred_over_the_per_format_leftovers() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("clip.f137.mp4"), vec![0u8; 4096]).unwrap();
        std::fs::write(dir.path().join("clip.mp4"), vec![0u8; 8]).unwrap();

        let found = produced_file(dir.path()).unwrap();

        assert_eq!(found.file_name().unwrap(), "clip.mp4");
    }

    #[test]
    fn a_single_format_download_is_found_by_size_and_part_files_are_skipped() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("clip.f18.mp4"), vec![0u8; 4096]).unwrap();
        std::fs::write(dir.path().join("clip.f140.m4a.part"), vec![0u8; 99_999]).unwrap();

        let found = produced_file(dir.path()).unwrap();

        assert_eq!(found.file_name().unwrap(), "clip.f18.mp4");
    }

    #[test]
    fn a_download_that_wrote_nothing_is_an_error_not_an_empty_trailer() {
        let dir = tempfile::tempdir().unwrap();

        assert!(produced_file(dir.path()).is_err());
    }

    #[test]
    fn a_stub_never_reaches_the_cache() {
        let dir = tempfile::tempdir().unwrap();
        let work = dir.path().join("work");
        std::fs::create_dir_all(&work).unwrap();
        std::fs::write(work.join("clip.mp4"), vec![0u8; 16]).unwrap();

        let err = into_place(&work, &dir.path().join("out.mp4")).unwrap_err();

        assert!(err.contains("empty"), "{err}");
    }
}
