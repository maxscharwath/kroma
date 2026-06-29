//! Playback progress: per-user saved positions and the "continue watching" join.

use super::*;

use crate::model::{ContinueItem, ProgressEntry};

/// Upsert one item's playback position for a user.
pub fn upsert_progress(
    pool: &Pool,
    user_id: &str,
    item_id: &str,
    position_ms: i64,
    duration_ms: Option<i64>,
) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO progress (user_id,item_id,position_ms,duration_ms,updated_at) \
         VALUES (?1,?2,?3,?4,?5) \
         ON CONFLICT(user_id,item_id) DO UPDATE SET \
            position_ms=excluded.position_ms, duration_ms=excluded.duration_ms, \
            updated_at=excluded.updated_at",
        params![user_id, item_id, position_ms, duration_ms, now_or_blank()],
    )?;
    Ok(())
}

/// One item's saved progress for a user, if any.
pub fn get_progress(pool: &Pool, user_id: &str, item_id: &str) -> Result<Option<ProgressEntry>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT item_id,position_ms,duration_ms,updated_at FROM progress \
         WHERE user_id = ?1 AND item_id = ?2",
    )?;
    let mut rows = stmt.query_map(params![user_id, item_id], row_to_progress)?;
    match rows.next() {
        Some(p) => Ok(Some(p?)),
        None => Ok(None),
    }
}

/// Every saved progress row for a user (newest first).
pub fn list_progress(pool: &Pool, user_id: &str) -> Result<Vec<ProgressEntry>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT item_id,position_ms,duration_ms,updated_at FROM progress \
         WHERE user_id = ?1 ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![user_id], row_to_progress)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Remove a saved position (e.g. finished, or "remove from Continue Watching").
pub fn delete_progress(pool: &Pool, user_id: &str, item_id: &str) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "DELETE FROM progress WHERE user_id = ?1 AND item_id = ?2",
        params![user_id, item_id],
    )?;
    Ok(())
}

/// "Continue watching": resumable items (started, not yet ~finished), newest
/// first, each carried as a full [`MediaItem`] so clients render normal cards.
pub fn continue_watching(pool: &Pool, user_id: &str) -> Result<Vec<ContinueItem>> {
    let conn = pool.get()?;
    // 1) The resumable item ids + their progress. The JOIN drops any orphan
    //    progress row whose item no longer exists.
    let mut stmt = conn.prepare(
        "SELECT p.item_id,p.position_ms,p.duration_ms,p.updated_at \
         FROM progress p JOIN items i ON i.id = p.item_id \
         WHERE p.user_id = ?1 AND p.position_ms > 15000 \
           AND (p.duration_ms IS NULL OR p.position_ms < p.duration_ms * 95 / 100) \
         ORDER BY p.updated_at DESC LIMIT 30",
    )?;
    let rows: Vec<(String, i64, Option<i64>, String)> = stmt
        .query_map(params![user_id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    drop(stmt);

    // 2) Hydrate each into a full item (with files) on the same connection.
    let mut item_stmt = conn.prepare(&format!("SELECT {ITEM_COLS} FROM items WHERE id = ?1"))?;
    let mut out = Vec::with_capacity(rows.len());
    for (item_id, position_ms, duration_ms, updated_at) in rows {
        let mut it = item_stmt.query_map(params![item_id], row_to_item)?;
        if let Some(item) = it.next() {
            let mut item = item?;
            attach_files(&conn, &mut item)?;
            out.push(ContinueItem { item, position_ms, duration_ms, updated_at });
        }
    }
    Ok(out)
}

// ----- watched (explicit "seen" marker, independent of resume position) -------

/// Mark an item as watched for a user, and drop any resume position so it leaves
/// "Continue watching". Idempotent (re-marking just refreshes `watched_at`).
pub fn mark_watched(pool: &Pool, user_id: &str, item_id: &str) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO watched (user_id,item_id,watched_at) VALUES (?1,?2,?3) \
         ON CONFLICT(user_id,item_id) DO UPDATE SET watched_at=excluded.watched_at",
        params![user_id, item_id, now_or_blank()],
    )?;
    conn.execute(
        "DELETE FROM progress WHERE user_id = ?1 AND item_id = ?2",
        params![user_id, item_id],
    )?;
    Ok(())
}

/// Clear an item's watched flag for a user. Idempotent.
pub fn unmark_watched(pool: &Pool, user_id: &str, item_id: &str) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "DELETE FROM watched WHERE user_id = ?1 AND item_id = ?2",
        params![user_id, item_id],
    )?;
    Ok(())
}

/// Every item id the user has marked (or finished) as watched — clients hydrate a
/// set once and badge cards from it.
pub fn list_watched(pool: &Pool, user_id: &str) -> Result<Vec<String>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT item_id FROM watched WHERE user_id = ?1")?;
    let rows = stmt.query_map(params![user_id], |r| r.get::<_, String>(0))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

// ----- my list ("Ma liste" — user bookmarks, synced across clients) -----------

/// Add a title to the user's list. Idempotent (re-adding refreshes `added_at`).
pub fn add_to_list(pool: &Pool, user_id: &str, item_id: &str) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO my_list (user_id,item_id,added_at) VALUES (?1,?2,?3) \
         ON CONFLICT(user_id,item_id) DO UPDATE SET added_at=excluded.added_at",
        params![user_id, item_id, now_or_blank()],
    )?;
    Ok(())
}

/// Remove a title from the user's list. Idempotent.
pub fn remove_from_list(pool: &Pool, user_id: &str, item_id: &str) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "DELETE FROM my_list WHERE user_id = ?1 AND item_id = ?2",
        params![user_id, item_id],
    )?;
    Ok(())
}

/// Every item id in the user's list, most-recently-added first.
pub fn list_my_list(pool: &Pool, user_id: &str) -> Result<Vec<String>> {
    let conn = pool.get()?;
    let mut stmt =
        conn.prepare("SELECT item_id FROM my_list WHERE user_id = ?1 ORDER BY added_at DESC")?;
    let rows = stmt.query_map(params![user_id], |r| r.get::<_, String>(0))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Map a row of `item_id,position_ms,duration_ms,updated_at` to a [`ProgressEntry`].
fn row_to_progress(r: &Row) -> rusqlite::Result<ProgressEntry> {
    Ok(ProgressEntry {
        item_id: r.get(0)?,
        position_ms: r.get(1)?,
        duration_ms: r.get(2)?,
        updated_at: r.get(3)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Permission;
    use std::sync::atomic::{AtomicU32, Ordering};

    static SEQ: AtomicU32 = AtomicU32::new(0);

    /// Fresh DB with one user and one movie item `m1` (so `progress` — which has an
    /// items FK — can be seeded).
    fn pool_with_user() -> (Pool, String) {
        let n = SEQ.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("luma-watched-{}-{n}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let pool = crate::db::init(&path).unwrap();
        let user = crate::db::create_user(&pool, "w@e.com", "w", "hash", &[Permission::Playback]).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO libraries (id,name,kind,path,added_at) VALUES ('lib','L','movie','/x','t')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO items (id,kind,title,container,library,added_at) \
             VALUES ('m1','movie','Dune','mkv','lib','t')",
            [],
        )
        .unwrap();
        (pool, user.id)
    }

    #[test]
    fn mark_unmark_round_trips_and_clears_progress() {
        let (pool, uid) = pool_with_user();
        assert!(list_watched(&pool, &uid).unwrap().is_empty());

        // A resume position that mark_watched should wipe.
        upsert_progress(&pool, &uid, "m1", 60_000, Some(120_000)).unwrap();
        mark_watched(&pool, &uid, "m1").unwrap();
        assert_eq!(list_watched(&pool, &uid).unwrap(), vec!["m1".to_string()]);
        assert!(get_progress(&pool, &uid, "m1").unwrap().is_none(), "marking watched clears resume");

        // Idempotent: marking again keeps a single row.
        mark_watched(&pool, &uid, "m1").unwrap();
        assert_eq!(list_watched(&pool, &uid).unwrap().len(), 1);

        // Shows (ids not in `items`) can be marked too — the column has no items FK.
        mark_watched(&pool, &uid, "show-7").unwrap();
        let mut ids = list_watched(&pool, &uid).unwrap();
        ids.sort();
        assert_eq!(ids, vec!["m1".to_string(), "show-7".to_string()]);

        unmark_watched(&pool, &uid, "m1").unwrap();
        assert_eq!(list_watched(&pool, &uid).unwrap(), vec!["show-7".to_string()]);
    }

    #[test]
    fn my_list_add_remove_round_trips() {
        let (pool, uid) = pool_with_user();
        assert!(list_my_list(&pool, &uid).unwrap().is_empty());

        add_to_list(&pool, &uid, "m1").unwrap();
        add_to_list(&pool, &uid, "show-7").unwrap(); // show ids allowed (no items FK)
        add_to_list(&pool, &uid, "m1").unwrap(); // idempotent
        let mut ids = list_my_list(&pool, &uid).unwrap();
        ids.sort();
        assert_eq!(ids, vec!["m1".to_string(), "show-7".to_string()]);

        remove_from_list(&pool, &uid, "m1").unwrap();
        assert_eq!(list_my_list(&pool, &uid).unwrap(), vec!["show-7".to_string()]);
    }
}
