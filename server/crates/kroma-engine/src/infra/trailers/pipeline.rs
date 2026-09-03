use std::io::Read;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use super::source::{ffmpeg_http_input, parse_source_urls, youtube_url, FORMAT};
#[cfg(not(test))]
use super::source::parse_duration_ms;

const DOWNLOAD_SECS: u64 = 180;
const FRAG_MP4: &str = "frag_keyframe+empty_moov+default_base_moof";
const MAX_BYTES: &str = "83886080";

pub fn download(key: &str, out: &Path) -> Result<(), String> {
    #[cfg(test)]
    if let Some(hook) = super::cache::test_override::get() {
        return hook(key, out);
    }
    match fetch(key, out, false) {
        Ok(()) => Ok(()),
        Err(remux) if remux.contains("timed out") || remux.contains("could not start") => {
            Err(remux)
        }
        Err(remux) => {
            let _ = std::fs::remove_file(out);
            fetch(key, out, true).map_err(|enc| format!("{remux}; {enc}"))
        }
    }
}

pub fn duration_ms(key: &str) -> Option<u64> {
    #[cfg(test)]
    {
        let _ = key;
        None
    }
    #[cfg(not(test))]
    {
        let output = Command::new("yt-dlp")
            .args([
                "--skip-download",
                "--print",
                "duration",
                "--no-playlist",
                "--no-warnings",
                "--no-progress",
                "--",
            ])
            .arg(youtube_url(key))
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        parse_duration_ms(&String::from_utf8_lossy(&output.stdout))
    }
}

fn fetch(key: &str, out: &Path, transcode: bool) -> Result<(), String> {
    let urls = source_urls(key)?;
    let mut ffmpeg = spawn_ffmpeg(&urls, out, transcode)?;
    wait_ffmpeg(&mut ffmpeg, Duration::from_secs(DOWNLOAD_SECS))
}

fn source_urls(key: &str) -> Result<Vec<String>, String> {
    let output = Command::new("yt-dlp")
        .args([
            "-f",
            FORMAT,
            "-S",
            "res:1080",
            "-g",
            "--no-playlist",
            "--no-progress",
            "--no-warnings",
            "--",
        ])
        .arg(youtube_url(key))
        .output()
        .map_err(|e| format!("could not start yt-dlp (is it installed and on PATH?): {e}"))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let tail = err.trim();
        return Err(if tail.is_empty() {
            format!(
                "yt-dlp {}",
                output
                    .status
                    .code()
                    .map_or_else(|| "killed".into(), |c| format!("exit {c}"))
            )
        } else {
            format!("yt-dlp: {tail}")
        });
    }
    parse_source_urls(&String::from_utf8_lossy(&output.stdout))
}

fn spawn_ffmpeg(urls: &[String], out: &Path, transcode: bool) -> Result<Child, String> {
    let mut ffmpeg = Command::new("ffmpeg");
    ffmpeg.args(["-nostdin", "-hide_banner", "-loglevel", "error"]);
    for url in urls {
        ffmpeg.args(ffmpeg_http_input(url)?);
    }
    if urls.len() >= 2 {
        ffmpeg.args(["-map", "0:v:0", "-map", "1:a:0?"]);
    }
    if transcode {
        ffmpeg.args([
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
        ]);
    } else {
        ffmpeg.args(["-c:v", "copy", "-c:a", "aac", "-ac", "2"]);
    }
    ffmpeg
        .args(["-fs", MAX_BYTES, "-movflags", FRAG_MP4, "-f", "mp4", "-y"])
        .arg(out)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start ffmpeg (is it installed and on PATH?): {e}"))
}

fn wait_ffmpeg(ffmpeg: &mut Child, dur: Duration) -> Result<(), String> {
    let drain = ffmpeg.stderr.take().map(|mut s| {
        std::thread::spawn(move || {
            let mut buf = String::new();
            let _ = s.read_to_string(&mut buf);
            buf
        })
    });
    let start = Instant::now();
    let outcome = loop {
        if start.elapsed() >= dur {
            let _ = ffmpeg.kill();
            let _ = ffmpeg.wait();
            break Err(format!(
                "trailer download timed out after {}s",
                dur.as_secs()
            ));
        }
        match ffmpeg.try_wait() {
            Ok(Some(status)) if status.success() => break Ok(()),
            Ok(Some(status)) => {
                break Err(format!(
                    "ffmpeg {}",
                    status
                        .code()
                        .map_or_else(|| "killed".into(), |c| format!("exit {c}"))
                ));
            }
            Ok(None) => {}
            Err(e) => break Err(format!("waiting on ffmpeg failed: {e}")),
        }
        std::thread::sleep(Duration::from_millis(50));
    };
    let stderr = drain.and_then(|h| h.join().ok()).unwrap_or_default();
    match outcome {
        Ok(()) => Ok(()),
        Err(msg) if msg.contains("timed out") || msg.contains("waiting on") => Err(msg),
        Err(msg) => Err(format!("{msg}{}", stderr_tail(&stderr))),
    }
}

fn stderr_tail(stderr: &str) -> String {
    let cleaned: String = stderr.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.is_empty() {
        return String::new();
    }
    let n = cleaned.chars().count();
    let tail: String = cleaned.chars().skip(n.saturating_sub(300)).collect();
    format!(" ({tail})")
}
