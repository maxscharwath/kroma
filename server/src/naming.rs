//! Plex-style filename / folder parsing.
//!
//! Decides whether a file is a movie or a TV episode, and pulls out the show
//! name, season, episode (incl. multi-episode files), titles and year — using
//! the same cues Plex/Jellyfin rely on:
//!   * `S01E02`, `s1e2`, `S01E02-E03`, `1x02` season/episode markers
//!   * the top-level folder under a library root as the *show* identity
//!     (`Library/Show Name/Season 01/Show - S01E02.mkv`)
//!   * `Movie Title (2017)` movie folders / filenames
//!   * release-junk stripping for clean titles (resolution, source, codec, group)

use std::path::Path;

/// Outcome of parsing one media file path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Parsed {
    Movie {
        title: String,
        year: Option<u32>,
    },
    Episode {
        show_title: String,
        show_year: Option<u32>,
        season: u32,
        episode: u32,
        /// Last episode for multi-episode files (`S01E02-E03`).
        episode_end: Option<u32>,
        episode_title: Option<String>,
    },
}

/// Parse a media file located at `path`, relative to its library `root`.
pub fn parse(root: &Path, path: &Path) -> Parsed {
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled");

    // Directory components between the library root and the file.
    let dirs: Vec<String> = path
        .parent()
        .and_then(|p| p.strip_prefix(root).ok())
        .map(|rel| {
            rel.components()
                .filter_map(|c| c.as_os_str().to_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default();

    if let Some(m) = find_marker(stem) {
        // Show identity: the top-level folder under the library root, else the
        // text before the marker in the filename (flat layout).
        let (show_title, show_year) = match dirs.first() {
            Some(folder) if !is_season_folder(folder) => (clean_title(folder), parse_year(folder)),
            _ => {
                let before = &stem[..m.start];
                (clean_title(before), parse_year(before))
            }
        };
        let show_title = if show_title.is_empty() {
            clean_title(stem)
        } else {
            show_title
        };

        let after = stem.get(m.end..).unwrap_or("");
        let episode_title = {
            let t = clean_episode_title(after);
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        };

        Parsed::Episode {
            show_title,
            show_year,
            season: m.season,
            episode: m.episode,
            episode_end: m.episode_end,
            episode_title,
        }
    } else {
        // Movie: prefer the filename when it carries a year, else fall back to a
        // `Title (Year)` parent folder (the canonical Plex movie layout).
        let parent = dirs.last().map(String::as_str);
        let (title, year) = if let Some(y) = parse_year(stem) {
            (clean_title(stem), Some(y))
        } else if let Some((p, y)) = parent.and_then(|p| parse_year(p).map(|y| (p, y))) {
            (clean_title(p), Some(y))
        } else {
            (clean_title(stem), None)
        };
        Parsed::Movie { title, year }
    }
}

// ----- season/episode markers -------------------------------------------------

#[derive(Debug, PartialEq, Eq)]
struct Marker {
    season: u32,
    episode: u32,
    episode_end: Option<u32>,
    start: usize,
    end: usize,
}

/// Find the first plausible season/episode marker in a filename stem.
fn find_marker(stem: &str) -> Option<Marker> {
    let lower = stem.to_ascii_lowercase();
    let b = lower.as_bytes();

    // Form 1: SxxEyy [(-|E)zz]
    let mut i = 0;
    while i < b.len() {
        if b[i] == b's' {
            let (sd, sn) = read_digits(b, i + 1);
            if sd > 0 {
                let j = i + 1 + sd;
                if j < b.len() && b[j] == b'e' {
                    let (ed, en) = read_digits(b, j + 1);
                    if ed > 0 && plausible(sn, en) {
                        let mut k = j + 1 + ed;
                        let mut episode_end = None;
                        // Optional multi-episode tail: "-E03", "-03", "E03".
                        let mut m = k;
                        if m < b.len() && b[m] == b'-' {
                            m += 1;
                        }
                        if m < b.len() && b[m] == b'e' {
                            m += 1;
                        }
                        if m > k {
                            let (ed2, en2) = read_digits(b, m);
                            if ed2 > 0 {
                                episode_end = Some(en2);
                                k = m + ed2;
                            }
                        }
                        return Some(Marker {
                            season: sn,
                            episode: en,
                            episode_end,
                            start: i,
                            end: k,
                        });
                    }
                }
            }
        }
        i += 1;
    }

    // Form 2: NxNN (e.g. 1x02). Bounded season to avoid matching resolutions.
    let mut i = 0;
    while i < b.len() {
        if b[i].is_ascii_digit() {
            let (sd, sn) = read_digits(b, i);
            let before_ok = i == 0 || !b[i - 1].is_ascii_alphanumeric();
            if before_ok && sd >= 1 && sn <= 50 {
                let xpos = i + sd;
                if xpos < b.len() && b[xpos] == b'x' {
                    let (ed, en) = read_digits(b, xpos + 1);
                    if ed >= 1 && plausible(sn, en) {
                        return Some(Marker {
                            season: sn,
                            episode: en,
                            episode_end: None,
                            start: i,
                            end: xpos + 1 + ed,
                        });
                    }
                }
            }
            i += sd.max(1);
        } else {
            i += 1;
        }
    }

    None
}

/// Guard against resolutions / wild numbers being read as season/episode.
fn plausible(season: u32, episode: u32) -> bool {
    season <= 100 && episode <= 9999
}

/// Read a run of ASCII digits from `start`; returns (count, parsed value).
fn read_digits(b: &[u8], start: usize) -> (usize, u32) {
    let mut n = 0;
    while start + n < b.len() && b[start + n].is_ascii_digit() {
        n += 1;
    }
    if n == 0 {
        return (0, 0);
    }
    let value: u32 = std::str::from_utf8(&b[start..start + n])
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    (n, value)
}

/// "Season 01", "Saison 1", "Specials", "S01" → a season folder, not a show.
fn is_season_folder(name: &str) -> bool {
    let l = name.trim().to_ascii_lowercase();
    l == "specials"
        || l.starts_with("season")
        || l.starts_with("saison")
        || (l.starts_with('s') && l.len() <= 4 && l[1..].bytes().all(|c| c.is_ascii_digit()))
}

// ----- title cleaning ---------------------------------------------------------

/// "Hard" release tokens (lowercase): unambiguous scene/source/codec markers.
/// Nobody titles a film `BluRay` or `x265`, so the first one reliably ends the
/// real title.
const HARD_TOKENS: &[&str] = &[
    "4k", "uhd", "bluray", "blu", "brrip", "bdrip", "bdremux", "webrip", "webdl", "hdtv", "sdtv",
    "pdtv", "dvdrip", "dvdscr", "dvd", "remux", "hdrip", "x264", "x265", "h264", "h265", "hevc",
    "avc", "xvid", "divx", "av1", "mpeg2", "vc1", "aac", "ac3", "eac3", "dts", "truehd", "atmos",
    "ddp", "dd5", "flac", "opus", "hdr", "hdr10", "hdr10plus", "dv", "dovi", "sdr", "10bit", "8bit",
    "vostfr",
];

/// "Soft" tokens: real dictionary words that also appear as release tags
/// (`FRENCH` dub, `EXTENDED`/`UNCUT` cut, `IMAX`…). They end the title **only**
/// when they sit directly inside the trailing release run (adjacent to a hard
/// marker), so legitimate titles like "The French Dispatch" and "Uncut Gems"
/// survive intact.
const SOFT_TOKENS: &[&str] = &[
    "french", "truefrench", "subfrench", "vff", "vof", "vfq", "multi", "extended", "unrated",
    "uncut", "imax", "proper", "repack", "remastered", "remaster", "theatrical", "integrale",
];

/// Clean a movie/show title: drop a trailing `(year)` and any release metadata,
/// normalise separators, collapse whitespace.
///
/// A parenthesised `(YYYY)` is treated as the authoritative year cut, so a title
/// that legitimately contains a number — "Blade Runner 2049 (2017)" — keeps the
/// number and loses only the real year.
pub fn clean_title(raw: &str) -> String {
    // normalize_separators preserves byte length (ASCII punctuation → space), so
    // a paren index found in `raw` is valid in `spaced`.
    let spaced = normalize_separators(raw);

    // A parenthesised `(YYYY)` is the authoritative title boundary: cut there and
    // ignore dictionary-word release tags that precede it. This keeps "The French
    // Dispatch (2021)" whole and lets "Blade Runner 2049 (2017)" keep its number.
    if let Some((i, _)) = paren_year(raw) {
        return finalize(&spaced[..i]);
    }

    // No parenthesised year: the title ends at the earliest of a bare 4-digit
    // year or the start of the trailing release run.
    let cut = [find_year_index(&spaced), release_cut_index(&spaced)]
        .into_iter()
        .flatten()
        .min();
    let title = match cut {
        Some(i) => finalize(&spaced[..i]),
        None => finalize(&spaced),
    };

    // A *leading* year (home video "2018 - LaserGame - Indian Forest") would
    // truncate the title to nothing; recover the text that follows it instead.
    if title.is_empty() {
        if let Some(i) = find_year_index(&spaced) {
            let after = finalize(&spaced[i + 4..]);
            if !after.is_empty() {
                return clean_title(&after);
            }
        }
    }
    title
}

/// A parenthesised year `(YYYY)`; returns the index of the `(` and the year.
fn paren_year(raw: &str) -> Option<(usize, u32)> {
    let b = raw.as_bytes();
    let mut i = 0;
    while i + 6 <= b.len() {
        if b[i] == b'(' && b[i + 5] == b')' && b[i + 1..i + 5].iter().all(u8::is_ascii_digit) {
            // Digits are verified ASCII above, so fold them directly — no UTF-8
            // decode / parse / unreachable fallback.
            let y = (b[i + 1] - b'0') as u32 * 1000
                + (b[i + 2] - b'0') as u32 * 100
                + (b[i + 3] - b'0') as u32 * 10
                + (b[i + 4] - b'0') as u32;
            if (1900..=2099).contains(&y) {
                return Some((i, y));
            }
        }
        i += 1;
    }
    None
}

/// Clean an episode title (text after the marker). No year-cut — episode names
/// can legitimately contain numbers — but release junk is still stripped.
fn clean_episode_title(raw: &str) -> String {
    let spaced = normalize_separators(raw);
    let end = release_cut_index(&spaced).unwrap_or(spaced.len());
    finalize(&spaced[..end])
}

fn normalize_separators(raw: &str) -> String {
    raw.replace(['.', '_'], " ")
        .replace(['[', ']', '{', '}', '(', ')'], " ")
}

fn finalize(s: &str) -> String {
    s.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .trim_matches('-')
        .trim()
        .to_string()
}

/// Byte index where the trailing release run begins, or `None`.
///
/// A hard marker (`1080p`, `BluRay`, `x265`, …) opens the run; soft dictionary
/// words (`FRENCH`, `EXTENDED`, `UNCUT`, …) are absorbed only when they sit
/// directly before it. So "Movie FRENCH 1080p" drops both words, while "The
/// French Dispatch" and "Uncut Gems" (no adjacent hard marker) keep theirs.
fn release_cut_index(s: &str) -> Option<usize> {
    let mut off = 0usize;
    let words: Vec<(usize, &str)> = s
        .split(' ')
        .map(|w| {
            let at = off;
            off += w.len() + 1; // +1 for the space we split on
            (at, w)
        })
        .collect();

    let hard = words.iter().position(|(_, w)| is_hard_word(w))?;
    let mut start = hard;
    while start > 0 && is_soft_word(words[start - 1].1) {
        start -= 1;
    }
    Some(words[start].0)
}

/// Strip surrounding punctuation and keep the part before a `-` (so `BluRay-1080p`
/// and `AAC-trailer` reduce to their leading token), lowercased.
fn token_head(word: &str) -> String {
    let w = word
        .trim_matches(|c: char| !c.is_ascii_alphanumeric())
        .to_ascii_lowercase();
    w.split('-').next().unwrap_or(&w).to_string()
}

/// A resolution token like `720p` / `1080p` / `2160p` / `1080i`.
fn is_resolution(head: &str) -> bool {
    head.strip_suffix(|c| c == 'p' || c == 'i')
        .map(|rest| !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit()))
        .unwrap_or(false)
}

fn is_hard_word(word: &str) -> bool {
    let head = token_head(word);
    !head.is_empty() && (HARD_TOKENS.contains(&head.as_str()) || is_resolution(&head))
}

fn is_soft_word(word: &str) -> bool {
    let head = token_head(word);
    !head.is_empty() && SOFT_TOKENS.contains(&head.as_str())
}

/// Find the byte index of a standalone 4-digit year (1900–2099).
pub fn find_year_index(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    let mut i = 0;
    while i + 4 <= bytes.len() {
        if bytes[i].is_ascii_digit() {
            let boundary_before = i == 0 || !bytes[i - 1].is_ascii_alphanumeric();
            let boundary_after = i + 4 == bytes.len() || !bytes[i + 4].is_ascii_alphanumeric();
            if boundary_before && boundary_after && is_plausible_year(&s[i..i + 4]) {
                return Some(i);
            }
        }
        i += 1;
    }
    None
}

fn is_plausible_year(chunk: &str) -> bool {
    chunk
        .parse::<u32>()
        .map(|y| (1900..=2099).contains(&y))
        .unwrap_or(false)
}

/// Best-effort year parse from a name. A parenthesised `(YYYY)` wins over a bare
/// 4-digit number so "Blade Runner 2049 (2017)" resolves to 2017.
pub fn parse_year(name: &str) -> Option<u32> {
    if let Some((_, y)) = paren_year(name) {
        return Some(y);
    }
    let s = normalize_separators(name);
    let idx = find_year_index(&s)?;
    s[idx..idx + 4].parse::<u32>().ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn p(root: &str, path: &str) -> Parsed {
        parse(Path::new(root), Path::new(path))
    }

    #[test]
    fn movie_in_year_folder() {
        assert_eq!(
            p("/m", "/m/Blade Runner 2049 (2017)/Blade Runner 2049 (2017) 2160p BluRay x265.mkv"),
            Parsed::Movie { title: "Blade Runner 2049".into(), year: Some(2017) }
        );
    }

    #[test]
    fn movie_flat_dotted() {
        assert_eq!(
            p("/m", "/m/The.Matrix.1999.1080p.BluRay.x264-GROUP.mp4"),
            Parsed::Movie { title: "The Matrix".into(), year: Some(1999) }
        );
    }

    #[test]
    fn movie_title_from_folder_when_file_is_generic() {
        assert_eq!(
            p("/m", "/m/Inception (2010)/movie.mkv"),
            Parsed::Movie { title: "Inception".into(), year: Some(2010) }
        );
    }

    #[test]
    fn episode_show_season_layout() {
        assert_eq!(
            p("/tv", "/tv/The Office (2005)/Season 02/The Office - S02E01 - The Dundies.mkv"),
            Parsed::Episode {
                show_title: "The Office".into(),
                show_year: Some(2005),
                season: 2,
                episode: 1,
                episode_end: None,
                episode_title: Some("The Dundies".into()),
            }
        );
    }

    #[test]
    fn episode_multi() {
        match p("/tv", "/tv/Show/Season 1/Show.S01E02-E03.mkv") {
            Parsed::Episode { season, episode, episode_end, .. } => {
                assert_eq!((season, episode, episode_end), (1, 2, Some(3)));
            }
            other => panic!("expected episode, got {other:?}"),
        }
    }

    #[test]
    fn episode_nxnn_flat() {
        match p("/tv", "/tv/Firefly - 1x02 - The Train Job.mkv") {
            Parsed::Episode { show_title, season, episode, .. } => {
                assert_eq!((show_title.as_str(), season, episode), ("Firefly", 1, 2));
            }
            other => panic!("expected episode, got {other:?}"),
        }
    }

    #[test]
    fn resolution_not_mistaken_for_episode() {
        // 1920x1080 must NOT parse as season 1920 / episode 1080.
        assert!(matches!(
            p("/m", "/m/Heat 1995 1920x1080.mkv"),
            Parsed::Movie { .. }
        ));
    }

    #[test]
    fn dictionary_words_survive_in_titles() {
        // "french"/"uncut" are release tags AND real words; the authoritative
        // `(YYYY)` boundary must win so the title is not clipped at them.
        assert_eq!(
            clean_title("The French Dispatch (2021) [EN+FR] Bluray-1080p"),
            "The French Dispatch"
        );
        assert_eq!(clean_title("Uncut Gems (2019) WEBDL-1080p"), "Uncut Gems");
        // Bare-year layout, still must keep the dictionary word.
        assert_eq!(
            clean_title("The French Connection 1971 1080p BluRay"),
            "The French Connection"
        );
    }

    #[test]
    fn french_dub_tag_stripped_when_adjacent_to_junk() {
        // No year: FRENCH sits right before a hard marker → both drop.
        assert_eq!(
            clean_title("Le Fabuleux Destin FRENCH DVDRip XviD"),
            "Le Fabuleux Destin"
        );
    }

    #[test]
    fn leading_year_recovers_title() {
        // A year at the start must not wipe the whole title to "".
        assert_eq!(
            clean_title("2018 - LaserGame - Indian Forest"),
            "LaserGame - Indian Forest"
        );
    }

    #[test]
    fn the_french_dispatch_parses_with_year() {
        assert_eq!(
            p(
                "/m",
                "/m/The French Dispatch (2021)/The French Dispatch (2021) [EN+FR] Bluray-1080p.mkv"
            ),
            Parsed::Movie { title: "The French Dispatch".into(), year: Some(2021) }
        );
    }
}
