//! Content-embedding storage + brute-force vector search.
//!
//! One row per title (movie OR show) in `item_vectors`, the embedding stored as a
//! little-endian `f32` BLOB. Vectors are L2-normalized at write time, so cosine
//! similarity is a plain dot product. At a few thousand titles a full in-memory
//! scan per query is microseconds no vector index needed. If a library ever
//! grows past ~50k items, swap [`load_vectors`] for an ANN index (sqlite-vec /
//! HNSW); the public functions here stay the same.
//!
//! Vectors are produced by the embedder port (the vector module) during enrichment.

use std::collections::HashSet;

use rusqlite::OptionalExtension;

use super::*;

/// Insert/replace one title's embedding. `vec` MUST already be L2-normalized.
pub fn set_item_vector(pool: &Pool, id: &str, vec: &[f32]) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO item_vectors (id, dim, vec, updated_at) VALUES (?1, ?2, ?3, ?4) \
         ON CONFLICT(id) DO UPDATE SET dim=excluded.dim, vec=excluded.vec, updated_at=excluded.updated_at",
        params![id, vec.len() as i64, vec_to_blob(vec), now_or_blank()],
    )?;
    Ok(())
}

/// Ids that have a stored embedding. Bulk signal for the pipeline elements list.
pub fn item_ids_with_vector(pool: &Pool) -> Result<HashSet<String>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT id FROM item_vectors")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Whether a title has a stored embedding (for the per-element treatments view).
pub fn has_vector(pool: &Pool, id: &str) -> Result<bool> {
    let conn = pool.get()?;
    let n: i64 =
        conn.query_row("SELECT COUNT(*) FROM item_vectors WHERE id=?1", params![id], |r| r.get(0))?;
    Ok(n > 0)
}

/// Delete one title's stored embedding, so a reprocess recomputes it.
pub fn clear_item_vector(pool: &Pool, id: &str) -> Result<()> {
    let conn = pool.get()?;
    conn.execute("DELETE FROM item_vectors WHERE id=?1", params![id])?;
    Ok(())
}

/// The stored embedding dimension for ONE id, or `None` if it has no vector yet.
/// Single-row indexed lookup so the embed stage can skip a vector already at the
/// active dim without loading the whole `item_vectors` table per subject.
pub fn vector_dim(pool: &Pool, id: &str) -> Result<Option<usize>> {
    let conn = pool.get()?;
    let dim: Option<i64> = conn
        .query_row("SELECT dim FROM item_vectors WHERE id=?1", params![id], |r| r.get(0))
        .optional()?;
    Ok(dim.map(|d| d as usize))
}

/// Current stored embedding dimension per id. Lets an idempotent re-embed skip
/// vectors already at the active embedder's dim (so switching embedders only
/// touches what's stale, instead of re-encoding the whole library each run).
pub fn vector_dims(pool: &Pool) -> Result<std::collections::HashMap<String, usize>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT id, dim FROM item_vectors")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? as usize)))?;
    Ok(rows.filter_map(std::result::Result::ok).collect())
}

/// Drop vectors whose id is no longer a live item or show (call after a rescan;
/// `item_vectors` has no FK because it spans both tables).
pub fn prune_orphan_vectors(pool: &Pool) -> Result<usize> {
    let conn = pool.get()?;
    let n = conn.execute(
        "DELETE FROM item_vectors WHERE id NOT IN (SELECT id FROM items) \
                                     AND id NOT IN (SELECT id FROM shows)",
        [],
    )?;
    Ok(n)
}

/// Load every stored vector as `(id, vector)`. The working set for all searches.
pub fn load_vectors(pool: &Pool) -> Result<Vec<(String, Vec<f32>)>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT id, vec FROM item_vectors")?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, blob_to_vec(&r.get::<_, Vec<u8>>(1)?)))
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// "More like this": the `n` nearest titles to `id` (excluding itself). Empty if
/// the seed has no stored vector yet.
pub fn similar(pool: &Pool, id: &str, n: usize) -> Result<Vec<(String, f32)>> {
    let vectors = load_vectors(pool)?;
    let Some(query) = vectors.iter().find(|(vid, _)| vid == id).map(|(_, v)| v.clone()) else {
        return Ok(Vec::new());
    };
    let exclude: HashSet<&str> = std::iter::once(id).collect();
    Ok(rank(&vectors, &query, &exclude, n))
}

/// Zero-shot themed row: the `n` titles nearest to a free-text `query` vector
/// (embed the phrase e.g. "christmas movie" with the same embedder first).
pub fn themed(pool: &Pool, query: &[f32], n: usize) -> Result<Vec<(String, f32)>> {
    let vectors = load_vectors(pool)?;
    Ok(rank(&vectors, query, &HashSet::new(), n))
}

/// Personalized "For You": average the vectors of what `user_id` recently watched
/// into a taste centroid, then return the `n` nearest *unwatched* titles. Pure
/// content-based no other users, no training, no cold-start beyond "watched
/// nothing yet" (which returns empty).
pub fn for_you(pool: &Pool, user_id: &str, n: usize) -> Result<Vec<(String, f32)>> {
    let watched = recent_watched_ids(pool, user_id)?;
    if watched.is_empty() {
        return Ok(Vec::new());
    }
    let vectors = load_vectors(pool)?;
    let Some(centroid) = centroid_of(&vectors, &watched) else {
        return Ok(Vec::new());
    };
    let exclude: HashSet<&str> = watched.iter().map(String::as_str).collect();
    Ok(rank(&vectors, &centroid, &exclude, n))
}

// ----- internals --------------------------------------------------------------

/// Most-recently-watched distinct item ids for one user (newest first, capped)
/// the taste window for [`for_you`] and the section generator.
pub fn recent_watched_ids(pool: &Pool, user_id: &str) -> Result<Vec<String>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT item_id FROM play_history \
         WHERE user_id = ?1 AND item_id IS NOT NULL \
         GROUP BY item_id ORDER BY MAX(ended_at) DESC LIMIT 50",
    )?;
    let rows = stmt.query_map(params![user_id], |r| r.get::<_, String>(0))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Mean of the vectors whose id is in `ids`, re-normalized. `None` if none match.
fn centroid_of(vectors: &[(String, Vec<f32>)], ids: &[String]) -> Option<Vec<f32>> {
    let want: HashSet<&str> = ids.iter().map(String::as_str).collect();
    let mut sum: Vec<f32> = Vec::new();
    let mut count = 0usize;
    for (id, v) in vectors {
        if !want.contains(id.as_str()) {
            continue;
        }
        if sum.is_empty() {
            sum = vec![0.0; v.len()];
        }
        if sum.len() == v.len() {
            for (s, x) in sum.iter_mut().zip(v) {
                *s += x;
            }
            count += 1;
        }
    }
    if count == 0 {
        return None;
    }
    l2_normalize(&mut sum);
    Some(sum)
}

/// Top-`n` `(id, score)` by descending dot product, skipping `exclude`.
fn rank(
    vectors: &[(String, Vec<f32>)],
    query: &[f32],
    exclude: &HashSet<&str>,
    n: usize,
) -> Vec<(String, f32)> {
    let mut scored: Vec<(String, f32)> = vectors
        .iter()
        .filter(|(id, v)| v.len() == query.len() && !exclude.contains(id.as_str()))
        .map(|(id, v)| (id.clone(), dot(query, v)))
        .collect();
    scored.sort_by(|a, b| b.1.total_cmp(&a.1));
    scored.truncate(n);
    scored
}

fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

fn l2_normalize(v: &mut [f32]) {
    let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
}

fn vec_to_blob(v: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(v.len() * 4);
    for x in v {
        bytes.extend_from_slice(&x.to_le_bytes());
    }
    bytes
}

fn blob_to_vec(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

// ----- render-ready rows ------------------------------------------------------

/// Hydrate ranked `(id, score)` pairs into full [`MediaItem`]s, preserving rank
/// order and dropping ids without a backing `items` row (show vectors live in the
/// same table, so this naturally yields a movies row).
fn hydrate(pool: &Pool, ranked: &[(String, f32)]) -> Result<Vec<MediaItem>> {
    let conn = pool.get()?;
    let ids: Vec<&str> = ranked.iter().map(|(id, _)| id.as_str()).collect();
    Ok(items_by_ids_ordered(&conn, &ids)?)
}

/// "For You" as render-ready movies: [`for_you`] + hydration. Over-fetches a
/// little since show ids drop during hydration, then trims to `n`.
pub fn recommended_for(pool: &Pool, user_id: &str, n: usize) -> Result<Vec<MediaItem>> {
    let ranked = for_you(pool, user_id, n + 8)?;
    let mut items = hydrate(pool, &ranked)?;
    items.truncate(n);
    Ok(items)
}

/// "More like this" as render-ready movies: [`similar`] + a genre-overlap guard
/// (the lexical embedder is weakly discriminative item↔item) + hydration.
/// Over-fetches generously since the guard prunes before the truncate to `n`.
pub fn similar_items(pool: &Pool, id: &str, n: usize) -> Result<Vec<MediaItem>> {
    let raw = similar(pool, id, (n + 8).max(48))?;
    let guarded = super::genre_guard(pool, id, raw.clone());
    // The guard can prune below `n` with a weakly-discriminative embedder (few
    // neighbours share a TMDB genre), which would shrink or empty the rail. Top up
    // from the unguarded neighbours so it always fills when candidates exist.
    let ranked = if guarded.len() >= n {
        guarded
    } else {
        let mut out = guarded;
        let have: std::collections::HashSet<String> = out.iter().map(|(id, _)| id.clone()).collect();
        for cand in raw {
            if out.len() >= n {
                break;
            }
            if !have.contains(&cand.0) {
                out.push(cand);
            }
        }
        out
    };
    let mut items = hydrate(pool, &ranked)?;
    items.truncate(n);
    // Embeddings can be sparse or absent (a fresh library before the embed stage
    // runs, an un-embedded title, or - for a series - an episode id, which carries
    // no vector of its own), which would leave the player's "up next" rail nearly
    // empty. Top up with recently-added titles, excluding the seed + what we
    // already have, so the rail always fills when the library has content.
    if items.len() < n {
        let mut have: std::collections::HashSet<String> =
            items.iter().map(|i| i.id.clone()).collect();
        have.insert(id.to_string());
        let recent = super::recently_added_ids(pool, n * 3)?;
        let mut extra_ids: Vec<&str> =
            recent.iter().filter(|r| !have.contains(r.as_str())).map(String::as_str).collect();
        // Only hydrate what actually fills the rail (each item is a full MediaItem).
        extra_ids.truncate(n - items.len());
        items.extend(super::items_by_ids(pool, &extra_ids)?);
    }
    Ok(items)
}

/// Themed row as render-ready movies: [`themed`] + hydration. `query` is an
/// already-embedded phrase vector; matches below `floor` cosine are dropped as
/// noise (so an off-library query like "christmas" returns few/none rather than
/// random classics).
pub fn themed_items(pool: &Pool, query: &[f32], n: usize, floor: f32) -> Result<Vec<MediaItem>> {
    let ranked: Vec<(String, f32)> =
        themed(pool, query, n + 8)?.into_iter().filter(|(_, s)| *s >= floor).collect();
    let mut items = hydrate(pool, &ranked)?;
    items.truncate(n);
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static SEQ: AtomicU32 = AtomicU32::new(0);

    /// Seed three movies a/b/c (with genres for the guard) + their unit vectors.
    /// a=[1,0], b=[0.8,0.6], c=[0,1]: a is nearest b, orthogonal to c.
    fn seeded() -> Pool {
        let n = SEQ.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("kroma-vec-{}-{n}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let pool = crate::init(&path).unwrap();
        {
            let conn = pool.get().unwrap();
            conn.execute("INSERT INTO libraries (id,name,kind,path,added_at) VALUES ('lib','L','movies','/x','t')", []).unwrap();
            let mk = |id: &str, genre: &str| {
                conn.execute(
                    "INSERT INTO items (id,kind,title,container,library,added_at,metadata) \
                     VALUES (?1,'movie','T','mkv','lib','t',?2)",
                    params![id, format!("{{\"tmdbId\":1,\"tmdbUrl\":\"x\",\"genres\":[\"{genre}\"]}}")],
                )
                .unwrap();
            };
            mk("a", "Horror");
            mk("b", "Horror");
            mk("c", "Comedy");
        }
        set_item_vector(&pool, "a", &[1.0, 0.0]).unwrap();
        set_item_vector(&pool, "b", &[0.8, 0.6]).unwrap();
        set_item_vector(&pool, "c", &[0.0, 1.0]).unwrap();
        pool
    }

    #[test]
    fn store_query_and_dims() {
        let p = seeded();
        assert!(has_vector(&p, "a").unwrap());
        assert!(!has_vector(&p, "ghost").unwrap());
        assert_eq!(item_ids_with_vector(&p).unwrap().len(), 3);
        assert_eq!(vector_dim(&p, "a").unwrap(), Some(2));
        assert!(vector_dim(&p, "ghost").unwrap().is_none());
        assert_eq!(vector_dims(&p).unwrap().len(), 3);

        // Blob roundtrip is bit-exact.
        let loaded: std::collections::HashMap<String, Vec<f32>> = load_vectors(&p).unwrap().into_iter().collect();
        assert_eq!(loaded["b"], vec![0.8, 0.6]);

        // Upsert overwrites in place (dim can change).
        set_item_vector(&p, "a", &[0.0, 0.0, 1.0]).unwrap();
        assert_eq!(vector_dim(&p, "a").unwrap(), Some(3));

        clear_item_vector(&p, "a").unwrap();
        assert!(!has_vector(&p, "a").unwrap());
    }

    #[test]
    fn similar_ranks_nearest_and_excludes_self() {
        let p = seeded();
        let near = similar(&p, "a", 10).unwrap();
        // a's nearest is b (dot 0.8), then c (dot 0.0); a itself excluded.
        assert_eq!(near.iter().map(|(id, _)| id.as_str()).collect::<Vec<_>>(), ["b", "c"]);
        assert!(near[0].1 > near[1].1);
        // A seed without a stored vector yields nothing.
        assert!(similar(&p, "ghost", 10).unwrap().is_empty());

        // Themed query nearest [1,0] is a, then b.
        let themed_hits = themed(&p, &[1.0, 0.0], 2).unwrap();
        assert_eq!(themed_hits[0].0, "a");
    }

    #[test]
    fn for_you_uses_watch_centroid_and_excludes_watched() {
        let p = seeded();
        // No history yet -> empty.
        assert!(for_you(&p, "u1", 10).unwrap().is_empty());
        assert!(recent_watched_ids(&p, "u1").unwrap().is_empty());

        p.get()
            .unwrap()
            .execute(
                "INSERT INTO play_history (id,user_id,item_id,kind,title,started_at,ended_at) \
                 VALUES ('h1','u1','a','movie','T',0,100)",
                [],
            )
            .unwrap();
        assert_eq!(recent_watched_ids(&p, "u1").unwrap(), vec!["a".to_string()]);
        let recs = for_you(&p, "u1", 10).unwrap();
        let ids: Vec<&str> = recs.iter().map(|(id, _)| id.as_str()).collect();
        // Centroid is 'a'; nearest unwatched is b then c, and 'a' is excluded.
        assert_eq!(ids, ["b", "c"]);
    }

    #[test]
    fn prune_orphans_drops_vectors_without_a_title() {
        let p = seeded();
        // Add a vector for an id that is neither an item nor a show.
        set_item_vector(&p, "orphan", &[1.0, 1.0]).unwrap();
        assert_eq!(prune_orphan_vectors(&p).unwrap(), 1);
        assert!(!has_vector(&p, "orphan").unwrap());
        assert!(has_vector(&p, "a").unwrap());
    }

    #[test]
    fn render_ready_rows_hydrate() {
        let p = seeded();
        // similar_items tops up past the genre guard so the rail fills.
        let sim = similar_items(&p, "a", 2).unwrap();
        assert_eq!(sim.len(), 2);
        assert_eq!(sim[0].id, "b"); // nearest + shares Horror

        p.get()
            .unwrap()
            .execute(
                "INSERT INTO play_history (id,user_id,item_id,kind,title,started_at,ended_at) \
                 VALUES ('h1','u1','a','movie','T',0,100)",
                [],
            )
            .unwrap();
        let recs = recommended_for(&p, "u1", 2).unwrap();
        assert!(recs.iter().any(|i| i.id == "b"));

        // Themed row keeps only above-floor matches, then hydrates.
        let themed = themed_items(&p, &[1.0, 0.0], 5, 0.5).unwrap();
        let ids: Vec<&str> = themed.iter().map(|i| i.id.as_str()).collect();
        assert!(ids.contains(&"a") && ids.contains(&"b") && !ids.contains(&"c"));
    }

    #[test]
    fn similar_items_fills_from_recent_when_no_embedding() {
        let p = seeded();
        // 'z' is a movie with NO vector (un-embedded, like a fresh library or an
        // episode id): similar() is empty, so the rail must fall back to
        // recently-added titles rather than returning nothing.
        p.get()
            .unwrap()
            .execute(
                "INSERT INTO items (id,kind,title,container,library,added_at,metadata) \
                 VALUES ('z','movie','Z','mkv','lib','z','{\"tmdbId\":1,\"tmdbUrl\":\"x\",\"genres\":[\"SciFi\"]}')",
                [],
            )
            .unwrap();
        let sim = similar_items(&p, "z", 3).unwrap();
        assert_eq!(sim.len(), 3); // filled from a/b/c
        assert!(!sim.iter().any(|i| i.id == "z")); // never recommends the seed itself
    }
}
