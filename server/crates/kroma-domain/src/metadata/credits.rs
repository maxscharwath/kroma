use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastMember {
    pub name: String,
    // None on every credit stored before the id was kept: those fold by name.
    #[serde(rename = "tmdbId", default, skip_serializing_if = "Option::is_none")]
    pub tmdb_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character: Option<String>,
    // A TMDB URL until `crate::image::localize` rewrites it to a local path.
    #[serde(
        rename = "profileUrl",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub profile_url: Option<String>,
}

/// `job` is the TMDB job title (`"Director"`, `"Writer"`, `"Creator"`, …).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrewMember {
    pub name: String,
    #[serde(rename = "tmdbId", default, skip_serializing_if = "Option::is_none")]
    pub tmdb_id: Option<u64>,
    pub job: String,
    #[serde(
        rename = "profileUrl",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub profile_url: Option<String>,
}

/// Not stored with a title's metadata: a person is not a library entity, so
/// this is resolved on demand and cached in memory.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PersonDetail {
    #[serde(rename = "tmdbId")]
    pub tmdb_id: u64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub biography: Option<String>,
    // `YYYY-MM-DD`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub birthday: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deathday: Option<String>,
    #[serde(rename = "placeOfBirth", skip_serializing_if = "Option::is_none")]
    pub place_of_birth: Option<String>,
    // TMDB's `known_for_department` (`"Acting"`, …), translated client-side.
    #[serde(rename = "knownFor", skip_serializing_if = "Option::is_none")]
    pub known_for: Option<String>,
    #[serde(rename = "profileUrl", skip_serializing_if = "Option::is_none")]
    pub profile_url: Option<String>,
    #[serde(rename = "tmdbUrl")]
    pub tmdb_url: String,
}
