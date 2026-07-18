//! Acquisition TMDB hint (`acq_tmdb`): pin a known TMDB id to the logical item
//! id an import will produce, so metadata enrichment adopts the real id instead
//! of re-guessing it from the filename.
//!
//! The `downloads` / `download_clients` ledger tables and their typed queries now
//! live in the tv.kroma.torrents module crate (`kroma_torrent::db`); only this
//! core hint table stays here, because `tmdb_hint` is read by the core enrichment
//! service (which depends on no module crate).

use super::*;

/// Pin a known TMDB id to the logical item id an import will produce, so
/// enrichment adopts it instead of guessing from the filename.
pub fn set_tmdb_hint(pool: &Pool, logical_id: &str, tmdb_id: u64) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO acq_tmdb (logical_id, tmdb_id) VALUES (?1, ?2) \
         ON CONFLICT(logical_id) DO UPDATE SET tmdb_id = excluded.tmdb_id",
        params![logical_id, tmdb_id as i64],
    )?;
    Ok(())
}

/// The pinned TMDB id for a logical item id, if any.
pub fn tmdb_hint(conn: &Connection, logical_id: &str) -> rusqlite::Result<Option<u64>> {
    use rusqlite::OptionalExtension;
    conn.query_row("SELECT tmdb_id FROM acq_tmdb WHERE logical_id = ?1", params![logical_id], |r| {
        r.get::<_, i64>(0).map(|v| v as u64)
    })
    .optional()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static SEQ: AtomicU32 = AtomicU32::new(0);

    fn pool() -> Pool {
        let n = SEQ.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("kroma-dl-{}-{n}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);
        crate::init(&path).unwrap()
    }

    #[test]
    fn tmdb_hint_upsert_and_lookup() {
        let p = pool();
        {
            let conn = p.get().unwrap();
            assert!(tmdb_hint(&conn, "logical-1").unwrap().is_none());
        }
        set_tmdb_hint(&p, "logical-1", 603).unwrap();
        {
            let conn = p.get().unwrap();
            assert_eq!(tmdb_hint(&conn, "logical-1").unwrap(), Some(603));
        }
        // Upsert replaces the pinned id in place.
        set_tmdb_hint(&p, "logical-1", 604).unwrap();
        let conn = p.get().unwrap();
        assert_eq!(tmdb_hint(&conn, "logical-1").unwrap(), Some(604));
        assert!(tmdb_hint(&conn, "unknown").unwrap().is_none());
    }
}
