//! The search pipeline shared by interactive search and the automatic
//! wanted-list job: a request + a scope -> Torznab queries -> decision-engine
//! scoring -> ordered candidate views.

pub mod backoff;
pub mod interactive;
pub mod manual;
pub mod sweep;
pub mod targets;

pub use interactive::{cached_release, grab_cached, interactive_search, score_release, CachedRelease};
pub use manual::manual_search;
pub use targets::{targets_for_scope, targets_for_wanted, wanted_ids_by, SearchScope, SearchTarget};

use kroma_module_sdk::db::WantedRow;

use crate::dtos::ScoredReleaseView;

/// Build a grab spec from a scored release the search chose, for a specific
/// request/title. `upgrade` marks a grab that replaces media already on disk.
#[allow(clippy::too_many_arguments)]
pub fn grab_spec_from_release(
    release: &ScoredReleaseView,
    magnet_or_url: &str,
    tmdb_id: u64,
    title: Option<String>,
    year: Option<u32>,
    request_id: Option<String>,
    wanted_ids: Vec<String>,
    upgrade: bool,
) -> kroma_module_sdk::ports::GrabSpec {
    kroma_module_sdk::ports::GrabSpec {
        magnet_or_url: magnet_or_url.to_string(),
        kind: release.target.clone(),
        tmdb_id,
        title,
        year,
        season: release.season,
        episodes: release.episodes.clone(),
        release_title: release.title.clone(),
        indexer_id: Some(release.indexer_id.clone()),
        size_bytes: release.size_bytes,
        score: release.score,
        score_breakdown: serde_json::to_string(&release.breakdown).ok(),
        request_id,
        wanted_ids,
        only_files: None,
        details_url: release.details_url.clone(),
        upgrade,
    }
}

/// The wanted rows a grab of this release covers (flip to `grabbed`).
pub fn wanted_ids_for(wanted: &[WantedRow], view: &ScoredReleaseView) -> Vec<String> {
    wanted_ids_by(wanted, &view.target, view.season, view.episodes.as_deref())
}
