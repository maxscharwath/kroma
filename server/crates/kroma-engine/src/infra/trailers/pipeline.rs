use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};

use super::normalise;
use super::source::{parse_line, ClipMeta, Line, FORMAT, PRINT, PROGRESS, SORT};
use super::source::youtube_url;

const DOWNLOAD_SECS: u64 = 300;
const SOCKET_TIMEOUT: &str = "20";
const MAX_FILESIZE: &str = "300M";
const CONNECTIONS: &str = "4";

/// What the download learned, as it learns it. `Meta` arrives before the first
/// byte, so a caller can answer a player that is waiting on the clip's length.
pub enum Event {
    Meta(Box<ClipMeta>),
    Percent(u8),
}

/// Fetches one YouTube key into `out` as an H.264/AAC MP4 with its moov up front.
/// `work` is scratch this owns: it is emptied first and left holding yt-dlp's
/// per-format files.
pub fn download(
    key: &str,
    work: &Path,
    out: &Path,
    on_event: &mut dyn FnMut(Event),
) -> Result<(), String> {
    #[cfg(test)]
    if let Some(hook) = super::cache::test_override::get() {
        return hook(key, out);
    }
    let first = fetch(key, work, on_event);
    // A media URL that 403s partway through is spent, not forbidden: the source
    // hands out short-lived ones and the copy dies around ten megabytes in.
    // Running yt-dlp again mints a fresh URL, so this is worth exactly one retry.
    match first {
        Err(msg) if is_expired_url(&msg) => fetch(key, work, on_event)
            .map_err(|again| format!("{msg}; retried: {again}"))?,
        other => other?,
    }
    normalise::into_place(work, out)
}

fn is_expired_url(msg: &str) -> bool {
    msg.contains("403") || msg.contains("Forbidden")
}

fn fetch(key: &str, work: &Path, on_event: &mut dyn FnMut(Event)) -> Result<(), String> {
    let _ = std::fs::remove_dir_all(work);
    std::fs::create_dir_all(work).map_err(|e| format!("could not create trailer scratch: {e}"))?;

    let mut child = spawn(key, work)?;
    let lines = read_lines(&mut child);
    let stderr = drain_stderr(&mut child);
    let outcome = pump(&mut child, lines, on_event);
    let stderr = stderr.and_then(|h| h.join().ok()).unwrap_or_default();
    outcome.map_err(|msg| format!("{msg}{}", tail(&stderr)))
}

fn spawn(key: &str, work: &Path) -> Result<Child, String> {
    Command::new("yt-dlp")
        .args([
            "-f",
            FORMAT,
            "-S",
            SORT,
            "--no-playlist",
            "--no-warnings",
            "--newline",
            "--no-simulate",
            "--print",
            PRINT,
            "--progress",
            "--progress-template",
            PROGRESS,
            "-N",
            CONNECTIONS,
            "--socket-timeout",
            SOCKET_TIMEOUT,
            "--max-filesize",
            MAX_FILESIZE,
            "--merge-output-format",
            "mp4",
            "--postprocessor-args",
            "Merger+ffmpeg_o:-movflags +faststart",
            "-o",
        ])
        .arg(work.join("clip.%(ext)s"))
        .arg("--")
        .arg(youtube_url(key))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start yt-dlp (is it installed and on PATH?): {e}"))
}

fn read_lines(child: &mut Child) -> Option<Receiver<String>> {
    let stdout = child.stdout.take()?;
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if tx.send(line).is_err() {
                return;
            }
        }
    });
    Some(rx)
}

fn drain_stderr(child: &mut Child) -> Option<std::thread::JoinHandle<String>> {
    let mut stderr = child.stderr.take()?;
    Some(std::thread::spawn(move || {
        let mut buf = String::new();
        let _ = stderr.read_to_string(&mut buf);
        buf
    }))
}

fn pump(
    child: &mut Child,
    lines: Option<Receiver<String>>,
    on_event: &mut dyn FnMut(Event),
) -> Result<(), String> {
    let mut percent = Percent::default();
    let deadline = Instant::now() + Duration::from_secs(DOWNLOAD_SECS);
    loop {
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("trailer download timed out after {DOWNLOAD_SECS}s"));
        }
        if let Some(rx) = lines.as_ref() {
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(line) => {
                    handle(&line, &mut percent, on_event);
                    continue;
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => {}
            }
        } else {
            std::thread::sleep(Duration::from_millis(100));
        }
        match child.try_wait() {
            Ok(Some(status)) if status.success() => return Ok(()),
            Ok(Some(status)) => {
                return Err(format!(
                    "yt-dlp {}",
                    status.code().map_or_else(|| "killed".into(), |c| format!("exit {c}"))
                ))
            }
            Ok(None) => {}
            Err(e) => return Err(format!("waiting on yt-dlp failed: {e}")),
        }
    }
}

fn handle(line: &str, percent: &mut Percent, on_event: &mut dyn FnMut(Event)) {
    match parse_line(line) {
        Line::Meta(meta) => {
            percent.grand_total = meta.bytes;
            on_event(Event::Meta(meta));
        }
        Line::Progress { done, total } => {
            if let Some(next) = percent.advance(done, total) {
                on_event(Event::Percent(next));
            }
        }
        Line::Other => {}
    }
}

/// yt-dlp reports one format at a time, so a whole-download percentage is the
/// formats already finished plus what has landed of the current one.
#[derive(Default)]
struct Percent {
    grand_total: Option<u64>,
    finished_bytes: u64,
    current_total: Option<u64>,
    last: u8,
}

impl Percent {
    fn advance(&mut self, done: u64, total: Option<u64>) -> Option<u8> {
        if total != self.current_total {
            self.finished_bytes += self.current_total.unwrap_or(0);
            self.current_total = total;
        }
        let total = self
            .grand_total
            .or_else(|| self.current_total.map(|t| self.finished_bytes + t))?;
        if total == 0 {
            return None;
        }
        let landed = self.finished_bytes + done;
        let next = ((landed.min(total) * 99) / total) as u8;
        (next > self.last).then(|| {
            self.last = next;
            next
        })
    }
}

fn tail(stderr: &str) -> String {
    let cleaned = stderr.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.is_empty() {
        return String::new();
    }
    let n = cleaned.chars().count();
    let tail: String = cleaned.chars().skip(n.saturating_sub(300)).collect();
    format!(" ({tail})")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn steps(feed: &[(u64, Option<u64>)], grand_total: Option<u64>) -> Vec<u8> {
        let mut p = Percent { grand_total, ..Percent::default() };
        feed.iter().filter_map(|&(done, total)| p.advance(done, total)).collect()
    }

    #[test]
    fn a_percentage_counts_the_audio_that_follows_the_video() {
        let out = steps(
            &[(0, Some(90)), (45, Some(90)), (90, Some(90)), (5, Some(10)), (10, Some(10))],
            Some(100),
        );

        assert_eq!(out.last(), Some(&99));
        assert!(out.windows(2).all(|w| w[0] < w[1]), "not monotonic: {out:?}");
    }

    #[test]
    fn a_percentage_never_reaches_a_hundred_before_the_file_is_in_place() {
        let out = steps(&[(50, Some(100)), (100, Some(100))], Some(100));

        assert_eq!(out, [49, 99]);
    }

    #[test]
    fn a_source_that_reports_no_size_still_moves_the_bar() {
        let out = steps(&[(25, Some(100)), (50, Some(100))], None);

        assert_eq!(out, [24, 49]);
    }

    #[test]
    fn a_download_with_no_size_anywhere_reports_nothing_rather_than_guessing() {
        assert!(steps(&[(1024, None), (4096, None)], None).is_empty());
    }

    #[test]
    fn a_spent_media_url_is_worth_another_extraction() {
        assert!(is_expired_url("yt-dlp exit 1 (ERROR: unable to download video data: HTTP Error 403: Forbidden)"));
        assert!(is_expired_url("ffmpeg exit 8 (Server returned 403 Forbidden)"));
    }

    #[test]
    fn a_private_video_is_not_retried() {
        assert!(!is_expired_url("yt-dlp exit 1 (ERROR: Private video)"));
        assert!(!is_expired_url("trailer download timed out after 300s"));
        assert!(!is_expired_url("could not start yt-dlp (is it installed and on PATH?)"));
    }

    #[test]
    fn a_stderr_tail_is_one_line_and_bounded() {
        let long = "x ".repeat(400);

        let out = tail(&long);

        assert!(out.chars().count() <= 303);
        assert!(!out.contains('\n'));
        assert_eq!(tail("   "), "");
    }
}
