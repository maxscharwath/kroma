//! `metadata.enrich` — re-resolve TMDB metadata (posters, overviews, embeddings)
//! for the whole catalog. Dispatches the enrichment worker pool; progress shows
//! in the activity panel.

use super::prelude::*;

pub(super) fn run(ctx: &JobContext) -> Result<()> {
    let state = &ctx.state;
    if state.config.tmdb_api_key.is_none() {
        ctx.warn("no TMDB API key configured — nothing to enrich");
        return Ok(());
    }
    let items = crate::db::list_items(&state.db, None)?;
    let shows = crate::db::list_shows(&state.db, None)?;
    ctx.info(format!(
        "re-enriching {} items and {} shows from TMDB…",
        items.len(),
        shows.len()
    ));
    crate::services::enrich::maybe_spawn(state, &items, &shows);
    ctx.info("enrichment dispatched (progress in the activity panel)");
    Ok(())
}
