//! Making a live database match the declared schema.

use std::collections::BTreeSet;

use anyhow::{Context, Result};
use rusqlite::Connection;

use super::{declared, SCHEMA};

/// Bring `conn` up to the declared schema, creating the database if it is empty.
///
/// Additive and idempotent: a table, column or index that is declared and
/// missing is created, and nothing else is touched. A change a declaration
/// cannot carry -- a drop, a rename, a backfill, a tightened constraint -- is
/// invisible here and needs a statement of its own.
pub(crate) fn apply(conn: &Connection) -> Result<()> {
    reconcile(conn, &SCHEMA)
}

// Three passes, because an index names columns: every table exists before a
// column is added to it, and every column exists before an index reads it.
fn reconcile(conn: &Connection, ddl: &str) -> Result<()> {
    let (mut tables, mut rest) = (Vec::new(), Vec::new());
    for statement in declared::statements(ddl) {
        match declared::table(&statement) {
            Some(table) => tables.push((statement, table)),
            None => rest.push(statement),
        }
    }

    run(conn, tables.iter().map(|(sql, _)| sql.as_str()))?;
    for (_, table) in &tables {
        add_missing_columns(conn, table)?;
    }
    run(conn, rest.iter().map(String::as_str))
}

fn run<'a>(conn: &Connection, statements: impl Iterator<Item = &'a str>) -> Result<()> {
    let batch = statements.collect::<Vec<_>>().join(";\n");
    if batch.is_empty() {
        return Ok(());
    }
    conn.execute_batch(&batch)
        .with_context(|| format!("failed to apply the declared schema: {batch:.120}"))
}

fn add_missing_columns(conn: &Connection, table: &declared::Table) -> Result<()> {
    let live = live_columns(conn, &table.name)?;
    for column in table.columns.iter().filter(|c| !live.contains(&c.name)) {
        let sql = format!(
            "ALTER TABLE {} ADD COLUMN {}",
            table.name, column.definition
        );
        conn.execute_batch(&sql)
            .with_context(|| format!("failed to add {}.{}", table.name, column.name))?;
    }
    Ok(())
}

fn live_columns(conn: &Connection, table: &str) -> Result<BTreeSet<String>> {
    let mut stmt = conn.prepare_cached("SELECT LOWER(name) FROM pragma_table_info(?1)")?;
    let names = stmt
        .query_map([table], |r| r.get::<_, String>(0))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(names)
}

#[cfg(test)]
mod tests {
    use super::super::pool_at;
    use super::*;

    fn open(dir: &kroma_testing::TempDir, name: &str) -> crate::PooledConn {
        let pool = pool_at(&dir.path().join(name), 2, None).unwrap();
        pool.get().unwrap()
    }

    fn columns(conn: &Connection, table: &str) -> BTreeSet<String> {
        live_columns(conn, table).unwrap()
    }

    #[test]
    fn an_empty_file_becomes_the_whole_declared_schema() {
        let dir = kroma_testing::temp_dir("reconcile-fresh");
        let conn = open(&dir, "kroma.db");

        apply(&conn).unwrap();

        for column in ["pin_hash", "audio_language", "subtitle_language"] {
            assert!(columns(&conn, "users").contains(column), "users.{column}");
        }
    }

    #[test]
    fn a_second_pass_changes_nothing() {
        let dir = kroma_testing::temp_dir("reconcile-idempotent");
        let conn = open(&dir, "kroma.db");
        apply(&conn).unwrap();
        let first = columns(&conn, "users");

        apply(&conn).unwrap();

        assert_eq!(columns(&conn, "users"), first);
    }

    #[test]
    fn declaring_a_column_is_the_only_edit_an_existing_database_needs() {
        const BEFORE: &str = "CREATE TABLE IF NOT EXISTS note (id TEXT PRIMARY KEY);";
        const AFTER: &str = "CREATE TABLE IF NOT EXISTS note (\
             id    TEXT PRIMARY KEY,\
             theme TEXT NOT NULL DEFAULT 'dark');\
             CREATE INDEX IF NOT EXISTS idx_note_theme ON note(theme);";
        let dir = kroma_testing::temp_dir("reconcile-one-place");
        let conn = open(&dir, "kroma.db");
        reconcile(&conn, BEFORE).unwrap();
        conn.execute_batch("INSERT INTO note (id) VALUES ('n1')")
            .unwrap();

        reconcile(&conn, AFTER).unwrap();

        let theme: String = conn
            .query_row("SELECT theme FROM note WHERE id = 'n1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            theme, "dark",
            "the row that predates the column gets its default"
        );
    }

    #[test]
    fn an_index_over_a_column_that_did_not_exist_yet_is_still_created() {
        let dir = kroma_testing::temp_dir("reconcile-index");
        let path = dir.path().join("kroma.db");
        let old = Connection::open(&path).unwrap();
        old.execute_batch(
            "CREATE TABLE wanted (\
                 id         TEXT PRIMARY KEY,\
                 request_id TEXT NOT NULL,\
                 kind       TEXT NOT NULL,\
                 tmdb_id    INTEGER NOT NULL,\
                 title      TEXT NOT NULL,\
                 status     TEXT NOT NULL DEFAULT 'wanted',\
                 updated_at INTEGER NOT NULL);",
        )
        .unwrap();
        drop(old);
        let conn = open(&dir, "kroma.db");

        apply(&conn).unwrap();

        let indexes: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'wanted'")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert!(indexes.iter().any(|n| n == "idx_wanted_due"), "{indexes:?}");
    }

    // `statements` splits on a bare `;`, which a compound `CREATE TRIGGER ...
    // BEGIN ... END` would shatter, and `table` reads neither a trigger nor a
    // virtual table. None is declared; this is what says so.
    #[test]
    fn the_declared_schema_holds_no_statement_the_splitter_cannot_carry() {
        for statement in declared::statements(&SCHEMA) {
            let head = statement.to_ascii_uppercase();
            assert!(
                !head.contains("CREATE TRIGGER") && !head.contains("CREATE VIRTUAL TABLE"),
                "{statement:.80}"
            );
        }
    }
}
