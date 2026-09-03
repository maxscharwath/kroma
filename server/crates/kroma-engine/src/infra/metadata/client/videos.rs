use kroma_domain::TrailerClip;
use serde::Deserialize;

use super::{api, curl_json};

#[derive(Deserialize)]
struct Videos {
    #[serde(default)]
    results: Vec<RawClip>,
}

#[derive(Deserialize)]
struct RawClip {
    #[serde(default)]
    key: String,
    #[serde(default)]
    site: String,
    #[serde(default, rename = "type")]
    kind: String,
    #[serde(default)]
    official: bool,
    #[serde(default)]
    iso_639_1: String,
    #[serde(default)]
    name: String,
}

pub(crate) fn movie_videos(api_key: &str, tmdb_id: u64) -> Result<Vec<TrailerClip>, ()> {
    if tmdb_id == 0 {
        return Ok(Vec::new());
    }
    let raw: Videos = curl_json(
        &format!("{}/movie/{tmdb_id}/videos", api()),
        api_key,
        &[("include_video_language", "fr,en,null".into())],
    )?;
    Ok(from_raw(raw.results))
}

fn from_raw(raw: Vec<RawClip>) -> Vec<TrailerClip> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for clip in raw {
        if !clip.site.eq_ignore_ascii_case("YouTube") || clip.key.is_empty() {
            continue;
        }
        if !seen.insert(clip.key.clone()) {
            continue;
        }
        out.push(TrailerClip {
            key: clip.key,
            site: "YouTube".into(),
            kind: clip.kind,
            official: clip.official,
            iso_639_1: clip.iso_639_1,
            name: clip.name,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn youtube_trailers_are_kept_and_vimeo_is_dropped() {
        let raw = vec![
            RawClip {
                key: "abc".into(),
                site: "YouTube".into(),
                kind: "Trailer".into(),
                official: true,
                iso_639_1: "fr".into(),
                name: "Bande-annonce".into(),
            },
            RawClip {
                key: "vim".into(),
                site: "Vimeo".into(),
                kind: "Trailer".into(),
                official: true,
                iso_639_1: "en".into(),
                name: String::new(),
            },
            RawClip {
                key: "abc".into(),
                site: "YouTube".into(),
                kind: "Trailer".into(),
                official: false,
                iso_639_1: "en".into(),
                name: String::new(),
            },
        ];

        let clips = from_raw(raw);

        assert_eq!(clips.len(), 1);
        assert_eq!(clips[0].key, "abc");
        assert_eq!(clips[0].iso_639_1, "fr");
        assert!(clips[0].official);
    }

    #[test]
    fn an_empty_key_is_dropped() {
        let clips = from_raw(vec![RawClip {
            key: String::new(),
            site: "YouTube".into(),
            kind: "Trailer".into(),
            official: true,
            iso_639_1: "en".into(),
            name: String::new(),
        }]);

        assert!(clips.is_empty());
    }
}
