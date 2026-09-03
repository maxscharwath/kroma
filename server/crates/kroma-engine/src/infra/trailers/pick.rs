use kroma_domain::TrailerClip;

pub fn pick<'a>(clips: &'a [TrailerClip], locale: &str) -> Option<&'a TrailerClip> {
    let lang = base_lang(locale);
    let youtube: Vec<&TrailerClip> = clips.iter().filter(|c| is_youtube(c)).collect();
    if youtube.is_empty() {
        return None;
    }
    for kind in ["Trailer", "Teaser"] {
        if let Some(hit) = pick_kind(&youtube, kind, &lang) {
            return Some(hit);
        }
    }
    None
}

fn pick_kind<'a>(clips: &[&'a TrailerClip], kind: &str, lang: &str) -> Option<&'a TrailerClip> {
    let of_kind: Vec<&TrailerClip> = clips
        .iter()
        .copied()
        .filter(|c| c.kind.eq_ignore_ascii_case(kind))
        .collect();
    if of_kind.is_empty() {
        return None;
    }
    let in_lang = |c: &&TrailerClip| c.iso_639_1.eq_ignore_ascii_case(lang);
    let in_en = |c: &&TrailerClip| c.iso_639_1.eq_ignore_ascii_case("en");
    let official = |c: &&TrailerClip| c.official;
    of_kind.iter().copied().find(|c| in_lang(c) && official(c))
        .or_else(|| of_kind.iter().copied().find(in_lang))
        .or_else(|| {
            if lang.eq_ignore_ascii_case("en") {
                None
            } else {
                of_kind.iter().copied().find(|c| in_en(c) && official(c))
            }
        })
        .or_else(|| {
            if lang.eq_ignore_ascii_case("en") {
                None
            } else {
                of_kind.iter().copied().find(in_en)
            }
        })
        .or_else(|| of_kind.iter().copied().find(official))
        .or_else(|| of_kind.first().copied())
}

fn is_youtube(clip: &TrailerClip) -> bool {
    clip.site.eq_ignore_ascii_case("YouTube") && !clip.key.is_empty()
}

fn base_lang(locale: &str) -> String {
    locale
        .split(['-', '_'])
        .next()
        .unwrap_or("en")
        .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clip(key: &str, lang: &str, kind: &str, official: bool) -> TrailerClip {
        TrailerClip {
            key: key.into(),
            site: "YouTube".into(),
            kind: kind.into(),
            official,
            iso_639_1: lang.into(),
            name: key.into(),
        }
    }

    #[test]
    fn a_french_official_trailer_beats_an_english_one() {
        let clips = [
            clip("en", "en", "Trailer", true),
            clip("fr", "fr", "Trailer", true),
        ];

        let hit = pick(&clips, "fr").unwrap();

        assert_eq!(hit.key, "fr");
    }

    #[test]
    fn missing_french_falls_to_english() {
        let clips = [clip("en", "en", "Trailer", true)];

        let hit = pick(&clips, "fr-FR").unwrap();

        assert_eq!(hit.key, "en");
    }

    #[test]
    fn official_outranks_unofficial_in_the_same_language() {
        let clips = [
            clip("fan", "fr", "Trailer", false),
            clip("studio", "fr", "Trailer", true),
        ];

        let hit = pick(&clips, "fr").unwrap();

        assert_eq!(hit.key, "studio");
    }

    #[test]
    fn a_teaser_is_used_only_when_no_trailer_exists() {
        let clips = [
            clip("tease", "fr", "Teaser", true),
            clip("en-trail", "en", "Trailer", true),
        ];

        let hit = pick(&clips, "fr").unwrap();

        assert_eq!(hit.key, "en-trail");
    }

    #[test]
    fn a_french_teaser_wins_when_every_trailer_is_gone() {
        let clips = [
            clip("en-tease", "en", "Teaser", true),
            clip("fr-tease", "fr", "Teaser", true),
        ];

        let hit = pick(&clips, "fr").unwrap();

        assert_eq!(hit.key, "fr-tease");
    }

    #[test]
    fn vimeo_and_empty_keys_are_ignored() {
        let clips = [
            TrailerClip {
                key: "vimeo1".into(),
                site: "Vimeo".into(),
                kind: "Trailer".into(),
                official: true,
                iso_639_1: "fr".into(),
                name: String::new(),
            },
            clip("", "en", "Trailer", true),
            clip("yt", "en", "Trailer", true),
        ];

        let hit = pick(&clips, "en").unwrap();

        assert_eq!(hit.key, "yt");
    }

    #[test]
    fn an_empty_catalog_has_no_clip() {
        assert!(pick(&[], "fr").is_none());
    }

    #[test]
    fn any_official_trailer_beats_an_unofficial_one_when_language_misses() {
        let clips = [
            clip("fan-de", "de", "Trailer", false),
            clip("studio-ja", "ja", "Trailer", true),
        ];

        let hit = pick(&clips, "fr").unwrap();

        assert_eq!(hit.key, "studio-ja");
    }
}
