// Every Latin letter whose NFD form is an ASCII letter plus a combining mark,
// which is the set the TypeScript side folds by decomposing. A letter with no
// such decomposition (`ß`, `æ`, `ø`, `ð`, `ł`) is NOT here: both sides turn it
// into a separator, and `slug.fixture.json` holds them to that.
const LATIN_FOLD: [(&str, char); 19] = [
    ("àáâãäåāăąǎǟǡǻȁȃȧ", 'a'),
    ("çćĉċč", 'c'),
    ("ď", 'd'),
    ("èéêëēĕėęěȅȇȩ", 'e'),
    ("ĝğġģǧǵ", 'g'),
    ("ĥȟ", 'h'),
    ("ìíîïĩīĭįǐȉȋ", 'i'),
    ("ĵǰ", 'j'),
    ("ķǩ", 'k'),
    ("ĺļľ", 'l'),
    ("ñńņňǹ", 'n'),
    ("òóôõöōŏőơǒǫǭȍȏȫȭȯȱ", 'o'),
    ("ŕŗřȑȓ", 'r'),
    ("śŝşšș", 's'),
    ("ţťț", 't'),
    ("ùúûüũūŭůűųưǔǖǘǚǜȕȗ", 'u'),
    ("ŵ", 'w'),
    ("ýÿŷȳ", 'y'),
    ("źżž", 'z'),
];

/// The URL segment a display name folds to: lowercased, accents dropped, every
/// run of anything else turned into one `-`, with no leading or trailing one.
/// Idempotent.
pub fn slugify(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars().flat_map(char::to_lowercase) {
        if is_combining_mark(ch) {
            continue;
        }
        match base_letter(ch) {
            Some(base) => out.push(base),
            None if !out.is_empty() && !out.ends_with('-') => out.push('-'),
            None => {}
        }
    }
    out.trim_end_matches('-').to_string()
}

fn is_combining_mark(ch: char) -> bool {
    matches!(ch, '\u{0300}'..='\u{036F}')
}

fn base_letter(ch: char) -> Option<char> {
    if ch.is_ascii_alphanumeric() {
        return Some(ch);
    }
    LATIN_FOLD
        .iter()
        .find(|(accented, _)| accented.contains(ch))
        .map(|&(_, base)| base)
}

#[cfg(test)]
mod tests {
    use super::*;

    use serde::Deserialize;

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Case {
        name: String,
        slug: String,
    }

    const SHARED_CASES: &str = include_str!("../../../../packages/core/src/slug.fixture.json");

    fn shared_cases() -> Vec<Case> {
        serde_json::from_str(SHARED_CASES).expect("slug.fixture.json is not the expected shape")
    }

    #[test]
    fn every_shared_case_folds_the_way_the_typescript_slugifier_folds_it() {
        for Case { name, slug } in shared_cases() {
            assert_eq!(slugify(&name), slug, "folding {name:?}");
        }
    }

    #[test]
    fn a_slug_read_back_off_a_url_folds_to_itself() {
        for Case { slug, .. } in shared_cases() {
            assert_eq!(slugify(&slug), slug);
        }
    }

    #[test]
    fn two_spellings_of_one_name_fold_together_and_two_names_stay_apart() {
        assert_eq!(
            slugify("  DENIS   villeneuve "),
            slugify("Denis Villeneuve")
        );
        assert_ne!(slugify("Conan O'Brien"), slugify("Conan OBrien"));
    }
}
