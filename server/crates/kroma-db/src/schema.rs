//! Opening a database: the pool, and the declared schema it is brought up to.

use std::path::Path;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use rusqlite::Connection;

use super::{Pool, PoolInner};

mod ddl;
pub(crate) mod declared;
mod reconcile;

pub(crate) use ddl::{FILE_COLS, ITEM_COLS, PRAGMAS, SCHEMA};

/// A pool over `path` with the pragmas applied and NO schema.
///
/// For a database this crate does not own the shape of -- a module's own file,
/// whose tables come from that module's `migrations()`. [`init`] would stamp the
/// whole core schema into it, which is forty tables it will never read.
pub fn open(path: &Path) -> Result<Pool> {
    pool_at(path, 4, None)
}

/// The one place a [`Pool`] is built. `scope` is `None` for a database its owner
/// is not scoped against, and the module grant otherwise.
///
/// Opens one connection before returning, so a path that cannot be opened fails
/// here rather than at whatever query happens to run first.
pub(crate) fn pool_at(
    path: &Path,
    max_idle: usize,
    scope: Option<crate::grant::Scope>,
) -> Result<Pool> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).ok();
    }
    let pool = Arc::new(PoolInner {
        path: path.to_path_buf(),
        idle: Mutex::new(Vec::new()),
        max_idle,
        scope,
    });
    let _ = pool.get()?;
    Ok(pool)
}

pub fn init(path: &Path) -> Result<Pool> {
    let pool = pool_at(path, 8, None)?;
    let conn = pool.get()?;
    reconcile::apply(&conn)?;
    Ok(pool)
}

/// Apply a module's own schema after the core schema at DB init (see
/// [`kroma_module_host::ServerModule::migrations`], run from the binary). The SQL
/// is `IF NOT EXISTS` DDL, so it is idempotent across every boot; it runs as one
/// batch, so a syntax error surfaces instead of being silently swallowed. Kept
/// here (rather than a raw `execute_batch` at the call site) so a module owns its
/// tables while the core stays the single place that touches the connection.
pub fn apply_migrations(conn: &Connection, sql: &str) -> Result<()> {
    conn.execute_batch(sql)
        .context("failed to apply module schema")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_modules_schema_applies_beside_the_core_one_and_a_broken_batch_names_itself() {
        let pool = crate::testing::temp_pool("schema-module");
        let conn = pool.get().unwrap();

        apply_migrations(
            &conn,
            "CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, body TEXT NOT NULL);\
             CREATE INDEX IF NOT EXISTS idx_notes_body ON notes(body);",
        )
        .unwrap();
        conn.execute("INSERT INTO notes (id, body) VALUES ('n1', 'hi')", [])
            .unwrap();

        apply_migrations(
            &conn,
            "CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, body TEXT NOT NULL);",
        )
        .unwrap();
        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            rows, 1,
            "re-applying the schema must not drop the module's data"
        );

        let err = apply_migrations(&conn, "CREATE TABL oops (").unwrap_err();
        assert!(
            format!("{err:#}").contains("failed to apply module schema"),
            "{err:#}"
        );
    }
}
