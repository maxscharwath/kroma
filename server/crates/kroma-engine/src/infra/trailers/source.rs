// yt-dlp is asked for the bytes, not just the URL. A googlevideo URL refuses a
// whole-file Range and throttles a single sequential connection, so anything
// that fetches one itself gets a 403 or ~1.4x realtime.

pub(super) const FORMAT: &str = "bv*[vcodec^=avc1][height<=1080]+ba[acodec^=mp4a]/bv*[vcodec^=avc1][height<=1080]+ba/b[vcodec^=avc1][height<=1080]/bv*[height<=1080]+ba/b";

pub(super) const SORT: &str = "res:1080,vcodec:h264,acodec:aac";

pub(super) const PRINT: &str =
    "META|%(duration)s|%(width)s|%(height)s|%(vcodec)s|%(acodec)s|%(filesize,filesize_approx)s";

pub(super) const PROGRESS: &str =
    "PROG|%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate)s";

pub(super) fn youtube_url(key: &str) -> String {
    format!("https://www.youtube.com/watch?v={key}")
}

/// What the source says the clip is, before a byte is written. The player needs
/// the length up front or its scrub bar has nothing to size against.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ClipMeta {
    pub duration_ms: Option<u64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub codec: Option<String>,
    pub audio_codec: Option<String>,
    pub bytes: Option<u64>,
}

pub(super) enum Line {
    Meta(Box<ClipMeta>),
    Progress { done: u64, total: Option<u64> },
    Other,
}

pub(super) fn parse_line(line: &str) -> Line {
    let line = line.trim();
    if let Some(rest) = line.strip_prefix("META|") {
        return Line::Meta(Box::new(parse_meta(rest)));
    }
    if let Some(rest) = line.strip_prefix("PROG|") {
        let mut parts = rest.split('|');
        let done = parts.next().and_then(|f| f.parse().ok());
        let total = parts.next().and_then(|f| f.parse().ok()).filter(|&n| n > 0);
        return match done {
            Some(done) => Line::Progress { done, total },
            None => Line::Other,
        };
    }
    Line::Other
}

fn parse_meta(rest: &str) -> ClipMeta {
    let f: Vec<&str> = rest.split('|').collect();
    let at = |i: usize| f.get(i).map(|s| s.trim()).filter(|s| !s.is_empty() && *s != "NA");
    ClipMeta {
        duration_ms: at(0).and_then(parse_duration_ms),
        width: at(1).and_then(|s| s.parse().ok()).filter(|&n| n > 0),
        height: at(2).and_then(|s| s.parse().ok()).filter(|&n| n > 0),
        codec: at(3).map(video_codec),
        audio_codec: at(4).map(audio_codec),
        bytes: at(5).and_then(|s| s.parse().ok()).filter(|&n| n > 0),
    }
}

fn parse_duration_ms(field: &str) -> Option<u64> {
    let secs: f64 = field.parse().ok()?;
    if !secs.is_finite() || secs <= 0.0 {
        return None;
    }
    Some((secs * 1000.0).round() as u64)
}

/// The container's codec string (`avc1.640028`) as the name the catalogue uses.
pub fn video_codec(raw: &str) -> String {
    let raw = raw.to_ascii_lowercase();
    for (prefix, name) in [
        ("avc1", "h264"),
        ("avc3", "h264"),
        ("h264", "h264"),
        ("hev1", "hevc"),
        ("hvc1", "hevc"),
        ("vp09", "vp9"),
        ("vp9", "vp9"),
        ("vp8", "vp8"),
        ("av01", "av1"),
    ] {
        if raw.starts_with(prefix) {
            return name.into();
        }
    }
    raw
}

pub fn audio_codec(raw: &str) -> String {
    let raw = raw.to_ascii_lowercase();
    if raw.starts_with("mp4a") || raw.starts_with("aac") {
        return "aac".into();
    }
    raw
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meta(line: &str) -> ClipMeta {
        match parse_line(line) {
            Line::Meta(m) => *m,
            _ => panic!("expected a META line"),
        }
    }

    #[test]
    fn a_meta_line_carries_the_length_the_player_needs() {
        let m = meta("META|150|1920|1080|avc1.640028|mp4a.40.2|30020983");

        assert_eq!(m.duration_ms, Some(150_000));
        assert_eq!((m.width, m.height), (Some(1920), Some(1080)));
        assert_eq!(m.codec.as_deref(), Some("h264"));
        assert_eq!(m.audio_codec.as_deref(), Some("aac"));
        assert_eq!(m.bytes, Some(30_020_983));
    }

    #[test]
    fn an_hls_rung_reports_no_size_and_still_reports_a_length() {
        let m = meta("META|187|1920|1080|avc1.640028|mp4a.40.2|NA");

        assert_eq!(m.duration_ms, Some(187_000));
        assert_eq!(m.bytes, None);
    }

    #[test]
    fn a_fractional_duration_rounds_to_whole_milliseconds() {
        assert_eq!(meta("META|98.4|||||").duration_ms, Some(98_400));
        assert_eq!(meta("META|0|||||").duration_ms, None);
        assert_eq!(meta("META|NA|||||").duration_ms, None);
    }

    #[test]
    fn a_progress_line_carries_what_has_landed_and_what_is_coming() {
        let Line::Progress { done, total } = parse_line("PROG|1024|27585008") else {
            panic!("expected a PROG line");
        };

        assert_eq!((done, total), (1024, Some(27_585_008)));
    }

    #[test]
    fn a_progress_line_with_no_total_yet_is_still_progress() {
        let Line::Progress { done, total } = parse_line("PROG|1024|NA") else {
            panic!("expected a PROG line");
        };

        assert_eq!((done, total), (1024, None));
    }

    #[test]
    fn yt_dlps_own_chatter_is_neither() {
        assert!(matches!(parse_line("[download] Destination: x.mp4"), Line::Other));
        assert!(matches!(parse_line(""), Line::Other));
    }

    #[test]
    fn a_container_codec_string_becomes_the_name_the_catalogue_uses() {
        assert_eq!(video_codec("avc1.640028"), "h264");
        assert_eq!(video_codec("vp09.00.40.08"), "vp9");
        assert_eq!(video_codec("av01.0.08M.08"), "av1");
        assert_eq!(audio_codec("mp4a.40.2"), "aac");
        assert_eq!(audio_codec("opus"), "opus");
    }

    #[test]
    fn the_selector_asks_for_h264_at_1080_before_anything_else() {
        let rungs: Vec<&str> = FORMAT.split('/').collect();

        assert!(rungs[0].contains("vcodec^=avc1"));
        assert!(rungs[0].contains("height<=1080"));
        assert!(rungs.iter().all(|r| r == &"b" || r.contains("height<=1080")));
        assert!(SORT.starts_with("res:1080"));
    }
}
