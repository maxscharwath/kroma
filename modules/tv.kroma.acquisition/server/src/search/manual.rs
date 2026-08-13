//! The free-text manual indexer search: no request, no ledger, no target to
//! score against. The admin types what they want, picks a row, and grabs it
//! through the manual-add flow.

use std::collections::HashSet;

use anyhow::{anyhow, Result};
use kroma_module_sdk::host::HostCtx;
use kroma_module_sdk::ports::Query;

use crate::dtos::{ManualReleaseView, ManualSearchBody, ManualSearchView};

// A show search must reach the tracker's TV categories (Torznab `t=tvsearch`),
// which only happens if the query carries a season: a bare `Query::Movie` for
// "Breaking Bad S03E04" searches the movie categories and finds nothing.
fn query_for(body: &ManualSearchBody, text: &str) -> Query {
    let title = text.to_string();
    let Some(season) = body.season else {
        return Query::Movie { tmdb_id: None, imdb_id: None, title, year: None };
    };
    // No episode typed means the whole season, whatever `kind` says: both
    // shapes reach the tracker's TV categories, and substituting episode 1
    // would search for one episode under a hint promising the season.
    match body.episode {
        Some(episode) => Query::Episode { tmdb_id: None, title, season, episode },
        None => Query::Season { tmdb_id: None, title, season },
    }
}

/// Free-text manual search across every enabled indexer: parse each result for
/// quality/episode hints and sort best-first, with no accept/reject scoring
/// since there's no specific target. The admin picks and grabs via the add
/// endpoint.
pub fn manual_search<S: HostCtx>(state: &S, body: &ManualSearchBody) -> Result<ManualSearchView> {
    let q = body.query.trim();
    if q.is_empty() {
        return Ok(ManualSearchView { releases: Vec::new(), indexers: Vec::new() });
    }
    let indexers = crate::indexer_db(state)?.enabled_indexers(state)?;
    if indexers.is_empty() {
        return Err(anyhow!("no enabled indexer; add one under Admin > Indexeurs"));
    }

    let query = query_for(body, q);
    let (found, reports) = crate::search::sweep::sweep(&indexers, |indexer| {
        Ok(crate::search_indexer(state, indexer, &query)?
            .into_iter()
            .map(|r| to_view(&r, &indexer.id, &indexer.name))
            .collect())
    });

    let mut seen: HashSet<(String, String)> = HashSet::new();
    let mut releases: Vec<ManualReleaseView> = found
        .into_iter()
        .filter(|r| seen.insert((r.indexer_id.clone(), r.guid.clone())))
        .collect();
    releases.sort_by(|a, b| {
        b.seeders
            .unwrap_or(0)
            .cmp(&a.seeders.unwrap_or(0))
            .then(b.size_bytes.unwrap_or(0).cmp(&a.size_bytes.unwrap_or(0)))
    });
    releases.truncate(150);
    Ok(ManualSearchView { releases, indexers: reports })
}

fn to_view(
    r: &kroma_module_sdk::ports::Release,
    indexer_id: &str,
    indexer_name: &str,
) -> ManualReleaseView {
    let p = kroma_module_sdk::scene::parse_release_name(&r.title);
    ManualReleaseView {
        title: r.title.clone(),
        guid: r.guid.clone(),
        indexer_id: indexer_id.to_string(),
        indexer_name: indexer_name.to_string(),
        download_url: r.magnet.clone().or_else(|| r.link.clone()),
        size_bytes: r.size_bytes,
        seeders: r.seeders,
        leechers: r.leechers,
        published_at: r.published_at.clone(),
        resolution: p.resolution.map(|res| format!("{res:?}").replace('R', "")),
        codec: p.codec.map(|c| format!("{c:?}")),
        source: p.source.map(|s| format!("{s:?}")),
        parsed_title: p.title,
        year: p.year,
        season: p.season,
        episode: p.episode,
        full_season: p.full_season,
        details_url: r.details_url.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(kind: Option<&str>, season: Option<u32>, episode: Option<u32>) -> ManualSearchBody {
        ManualSearchBody {
            query: "Breaking Bad".into(),
            kind: kind.map(str::to_string),
            season,
            episode,
        }
    }

    #[test]
    fn a_bare_query_stays_a_movie_search() {
        assert!(matches!(
            query_for(&body(None, None, None), "Heat"),
            Query::Movie { title, .. } if title == "Heat"
        ));
    }

    #[test]
    fn a_season_alone_is_a_season_search() {
        assert!(matches!(
            query_for(&body(None, Some(3), None), "Breaking Bad"),
            Query::Season { season: 3, .. }
        ));
    }

    #[test]
    fn a_season_and_episode_is_an_episode_search() {
        assert!(matches!(
            query_for(&body(None, Some(3), Some(7)), "Breaking Bad"),
            Query::Episode { season: 3, episode: 7, .. }
        ));
    }

    #[test]
    fn an_episode_kind_without_a_number_sweeps_the_season() {
        // What the form's own hint promises. Substituting episode 1 searched for
        // one episode under a hint reading "S02".
        assert!(matches!(
            query_for(&body(Some("episode"), Some(2), None), "Breaking Bad"),
            Query::Season { season: 2, .. }
        ));
    }
}
