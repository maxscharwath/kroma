use serde::{Deserialize, Serialize};

/// One clip on a title's provider video list. `kind` is the provider's own word
/// ("Trailer", "Teaser"), `site` its host, and `key` that host's id: only
/// YouTube keys are ever played, and only through the server's local copy.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct TrailerClip {
    pub key: String,
    pub site: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub official: bool,
    #[serde(rename = "iso6391")]
    pub iso_639_1: String,
    #[serde(default)]
    pub name: String,
}
