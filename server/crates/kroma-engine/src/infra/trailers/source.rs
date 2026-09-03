pub(super) const FORMAT: &str = "bv*[vcodec^=avc1][height>=1080]+ba[ext=m4a]/bv*[height>=1080]+ba/b[ext=mp4][vcodec^=avc1][height>=1080]/bv*[vcodec^=avc1]+ba[ext=m4a]/b";

pub(super) fn youtube_url(key: &str) -> String {
    format!("https://www.youtube.com/watch?v={key}")
}

pub(super) fn parse_duration_ms(stdout: &str) -> Option<u64> {
    let line = stdout.lines().map(str::trim).find(|l| !l.is_empty())?;
    let secs: f64 = line.parse().ok()?;
    if !secs.is_finite() || secs <= 0.0 {
        return None;
    }
    Some((secs * 1000.0).round() as u64)
}

pub(super) fn content_length(url: &str) -> Option<u64> {
    url.split(['?', '&'])
        .find_map(|pair| pair.strip_prefix("clen="))?
        .parse()
        .ok()
        .filter(|&n| n > 0)
}

pub(super) fn closed_range(len: u64) -> String {
    format!("bytes=0-{}", len.saturating_sub(1))
}

const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

pub(super) fn ffmpeg_http_input(url: &str) -> Result<Vec<String>, String> {
    let len = content_length(url).ok_or_else(|| "media URL has no length".to_string())?;
    Ok(vec![
        "-icy".into(),
        "0".into(),
        "-user_agent".into(),
        BROWSER_UA.into(),
        "-headers".into(),
        format!("Range: {}\r\n", closed_range(len)),
        "-i".into(),
        url.into(),
    ])
}

pub(super) fn parse_source_urls(stdout: &str) -> Result<Vec<String>, String> {
    let urls: Vec<String> = stdout
        .lines()
        .map(str::trim)
        .filter(|l| l.starts_with("http://") || l.starts_with("https://"))
        .map(str::to_string)
        .collect();
    if urls.is_empty() {
        Err("yt-dlp returned no media URL".into())
    } else {
        Ok(urls)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duration_comes_from_the_info_json_without_any_file() {
        assert_eq!(parse_duration_ms("145.0\n"), Some(145_000));
        assert_eq!(parse_duration_ms("  98.4  "), Some(98_400));
        assert_eq!(parse_duration_ms("NA"), None);
        assert_eq!(parse_duration_ms("0"), None);
        assert_eq!(parse_duration_ms(""), None);
    }

    #[test]
    fn source_urls_are_the_http_lines_yt_dlp_prints() {
        let out = "https://googlevideo.com/v\nhttps://googlevideo.com/a\nWARNING: ignore me\n";

        let urls = parse_source_urls(out).unwrap();

        assert_eq!(
            urls,
            [
                "https://googlevideo.com/v",
                "https://googlevideo.com/a"
            ]
        );
    }

    #[test]
    fn a_blank_yt_dlp_dump_is_not_a_source() {
        let err = parse_source_urls("ERROR: private video\n").unwrap_err();

        assert!(err.contains("no media URL"));
    }

    #[test]
    fn the_selector_asks_for_1080p_before_anything_shorter() {
        let parts: Vec<&str> = FORMAT.split('/').collect();
        let at_least = parts.iter().position(|p| p.contains("height>=1080"));
        let shorter = parts.iter().position(|p| {
            p.contains("height<=1080") && !p.contains("height>=1080")
        });

        assert_eq!(at_least, Some(0));
        assert!(shorter.is_none_or(|i| i > 0));
        assert!(parts[0].starts_with("bv"));
    }

    #[test]
    fn a_googlevideo_url_carries_its_length_in_clen() {
        let url = "https://rr1.googlevideo.com/videoplayback?expire=1&clen=60134613&dur=149";

        assert_eq!(content_length(url), Some(60_134_613));
        assert_eq!(closed_range(60_134_613), "bytes=0-60134612");
    }

    #[test]
    fn a_url_without_a_length_is_not_fetched_with_an_open_range() {
        assert_eq!(content_length("https://example.com/v"), None);
        assert_eq!(content_length("https://example.com/v?clen=0"), None);
        assert!(ffmpeg_http_input("https://example.com/v").is_err());
    }

    #[test]
    fn ffmpeg_asks_the_cdn_for_a_closed_byte_range() {
        let url = "https://rr1.googlevideo.com/videoplayback?clen=1000";

        let args = ffmpeg_http_input(url).unwrap();

        assert!(
            args.windows(2)
                .any(|w| w[0] == "-headers" && w[1] == "Range: bytes=0-999\r\n")
        );
        assert!(args.windows(2).any(|w| w[0] == "-icy" && w[1] == "0"));
        assert!(!args.iter().any(|a| a.contains("reconnect")));
    }
}
