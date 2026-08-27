use std::collections::BTreeMap;

use rusqlite::types::ToSqlOutput;
use rusqlite::{Connection, ToSql};

use super::{row_to_download, DownloadRow, DL_COLS};

/// What the queue is narrowed to. Fields are additive and an empty filter is
/// the whole ledger, so the unfiltered page is the same query path as any
/// other.
#[derive(Debug, Clone, Default)]
pub struct DownloadFilter {
    /// Statuses to keep; empty is every status.
    pub statuses: Vec<String>,
    /// Engines to keep; empty is every engine.
    pub client_ids: Vec<String>,
    /// `movie` | `season` | `episode`; empty is every kind.
    pub kinds: Vec<String>,
    /// Substring of the release name or the resolved title.
    pub search: Option<String>,
    /// Only rows no TMDB title has been pinned to yet.
    pub unlinked: bool,
}

// LIKE treats these as wildcards, so a release name containing one would widen
// the search instead of narrowing it. Paired with `ESCAPE '\'` below.
fn like_pattern(needle: &str) -> String {
    let mut out = String::with_capacity(needle.len() + 2);
    out.push('%');
    for c in needle.chars() {
        if matches!(c, '%' | '_' | '\\') {
            out.push('\\');
        }
        out.push(c);
    }
    out.push('%');
    out
}

enum Bound {
    Text(String),
    Int(i64),
}

impl ToSql for Bound {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        match self {
            Bound::Text(s) => s.to_sql(),
            Bound::Int(n) => n.to_sql(),
        }
    }
}

// One `column IN (…)` term, or nothing when the caller named no values. Values
// are always bound; only the PLACEHOLDER numbering is built from how many binds
// the clauses before it already took.
fn any_of(column: &str, values: &[String], binds: &mut Vec<Bound>) -> Option<String> {
    if values.is_empty() {
        return None;
    }
    let slots: Vec<String> = (0..values.len())
        .map(|i| format!("?{}", binds.len() + 1 + i))
        .collect();
    binds.extend(values.iter().map(|v| Bound::Text(v.clone())));
    Some(format!("{column} IN ({})", slots.join(", ")))
}

fn where_clause(filter: &DownloadFilter) -> (String, Vec<Bound>) {
    let mut clauses: Vec<String> = Vec::new();
    let mut binds: Vec<Bound> = Vec::new();

    clauses.extend(any_of("status", &filter.statuses, &mut binds));
    clauses.extend(any_of("client_id", &filter.client_ids, &mut binds));
    clauses.extend(any_of("kind", &filter.kinds, &mut binds));
    if let Some(search) = &filter.search {
        let slot = format!("?{}", binds.len() + 1);
        clauses.push(format!(
            "(release_title LIKE {slot} ESCAPE '\\' OR COALESCE(title, '') LIKE {slot} ESCAPE '\\')"
        ));
        binds.push(Bound::Text(like_pattern(search)));
    }
    if filter.unlinked {
        clauses.push("tmdb_id = 0".to_string());
    }

    if clauses.is_empty() {
        (String::new(), binds)
    } else {
        (format!(" WHERE {}", clauses.join(" AND ")), binds)
    }
}

/// How many rows the filter matches, for the page count.
pub fn count_downloads(conn: &Connection, filter: &DownloadFilter) -> rusqlite::Result<i64> {
    let (where_sql, binds) = where_clause(filter);
    let params: Vec<&dyn ToSql> = binds.iter().map(|b| b as &dyn ToSql).collect();
    conn.query_row(
        &format!("SELECT COUNT(*) FROM downloads{where_sql}"),
        params.as_slice(),
        |r| r.get(0),
    )
}

/// One page of the filtered ledger, newest grab first.
pub fn page_downloads(
    conn: &Connection,
    filter: &DownloadFilter,
    offset: i64,
    limit: i64,
) -> rusqlite::Result<Vec<DownloadRow>> {
    let (where_sql, mut binds) = where_clause(filter);
    let limit_slot = format!("?{}", binds.len() + 1);
    let offset_slot = format!("?{}", binds.len() + 2);
    binds.push(Bound::Int(limit));
    binds.push(Bound::Int(offset));
    let params: Vec<&dyn ToSql> = binds.iter().map(|b| b as &dyn ToSql).collect();
    let mut stmt = conn.prepare(&format!(
        "SELECT {DL_COLS} FROM downloads{where_sql} \
         ORDER BY grabbed_at DESC, id DESC LIMIT {limit_slot} OFFSET {offset_slot}"
    ))?;
    let rows = stmt.query_map(params.as_slice(), row_to_download)?;
    rows.collect()
}

/// The whole-ledger rollup behind the filter chips and the totals cards: it is
/// deliberately NOT filtered, because a chip has to say how many rows it would
/// reveal.
#[derive(Debug, Clone, Default)]
pub struct DownloadTotals {
    pub by_status: BTreeMap<String, i64>,
    pub downloaded_bytes: u64,
    pub uploaded_bytes: u64,
}

pub fn download_totals(conn: &Connection) -> rusqlite::Result<DownloadTotals> {
    let mut stmt = conn.prepare("SELECT status, COUNT(*) FROM downloads GROUP BY status")?;
    let by_status = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?
        .collect::<rusqlite::Result<BTreeMap<String, i64>>>()?;
    let (down, up) = conn.query_row(
        "SELECT COALESCE(SUM(downloaded_bytes), 0), COALESCE(SUM(uploaded_bytes), 0) FROM downloads",
        [],
        |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)),
    )?;
    Ok(DownloadTotals {
        by_status,
        downloaded_bytes: down.max(0) as u64,
        uploaded_bytes: up.max(0) as u64,
    })
}

/// How many downloads are occupying an engine slot right now, for the
/// parallelism cap. `queued` rows are the ones waiting for one, so they do not
/// count against it.
pub fn running_download_count(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM downloads WHERE status IN ('downloading', 'seeding')",
        [],
        |r| r.get(0),
    )
}

/// Queued rows in grab order, so the slot that just freed goes to the download
/// that has been waiting longest.
pub fn queued_downloads(conn: &Connection) -> rusqlite::Result<Vec<DownloadRow>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {DL_COLS} FROM downloads WHERE status = 'queued' ORDER BY grabbed_at"
    ))?;
    let rows = stmt.query_map([], row_to_download)?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::super::write::*;
    use super::*;
    use crate::db::test_support::{download, test_db};

    fn seed() -> kroma_module_sdk::db::testing::TempPool {
        let pool = test_db();
        for (id, status, at) in [
            ("d_q", "queued", 10),
            ("d_d", "downloading", 20),
            ("d_s", "seeding", 30),
            ("d_c", "completed", 40),
            ("d_f", "failed", 50),
        ] {
            insert_download(&pool, &download(id, status, at)).unwrap();
        }
        pool
    }

    #[test]
    fn an_empty_filter_pages_the_whole_ledger_newest_first() {
        let pool = seed();
        let conn = pool.get().unwrap();
        let filter = DownloadFilter::default();

        let first = page_downloads(&conn, &filter, 0, 2).unwrap();
        let second = page_downloads(&conn, &filter, 2, 2).unwrap();

        assert_eq!(count_downloads(&conn, &filter).unwrap(), 5);
        assert_eq!(
            first.iter().map(|d| d.id.as_str()).collect::<Vec<_>>(),
            ["d_f", "d_c"]
        );
        assert_eq!(
            second.iter().map(|d| d.id.as_str()).collect::<Vec<_>>(),
            ["d_s", "d_d"]
        );
    }

    #[test]
    fn a_status_filter_narrows_the_count_and_the_page_together() {
        let pool = seed();
        let conn = pool.get().unwrap();
        let filter = DownloadFilter {
            statuses: vec!["downloading".into(), "seeding".into()],
            ..DownloadFilter::default()
        };

        let page = page_downloads(&conn, &filter, 0, 25).unwrap();

        assert_eq!(count_downloads(&conn, &filter).unwrap(), 2);
        assert_eq!(
            page.iter().map(|d| d.id.as_str()).collect::<Vec<_>>(),
            ["d_s", "d_d"]
        );
    }

    #[test]
    fn a_search_matches_the_release_name_and_treats_a_wildcard_as_a_literal() {
        let pool = test_db();
        let mut plain = download("plain", "queued", 10);
        plain.release_title = "Frieren.S01.1080p".into();
        let mut percent = download("percent", "queued", 20);
        percent.release_title = "100%.Wolf.2020".into();
        insert_download(&pool, &plain).unwrap();
        insert_download(&pool, &percent).unwrap();
        let conn = pool.get().unwrap();

        let hit = DownloadFilter {
            search: Some("frieren".into()),
            ..DownloadFilter::default()
        };
        let literal = DownloadFilter {
            search: Some("100%".into()),
            ..DownloadFilter::default()
        };

        assert_eq!(count_downloads(&conn, &hit).unwrap(), 1);
        assert_eq!(count_downloads(&conn, &literal).unwrap(), 1);
        assert_eq!(
            page_downloads(&conn, &literal, 0, 25).unwrap()[0].id,
            "percent"
        );
    }

    #[test]
    fn totals_roll_up_every_status_and_both_byte_counters() {
        let pool = seed();
        update_download_bytes(&pool, "d_s", 900, 450).unwrap();
        update_download_bytes(&pool, "d_c", 100, 50).unwrap();
        let conn = pool.get().unwrap();

        let totals = download_totals(&conn).unwrap();

        assert_eq!(totals.by_status.get("queued"), Some(&1));
        assert_eq!(totals.by_status.get("downloading"), Some(&1));
        assert_eq!(totals.downloaded_bytes, 1000);
        assert_eq!(totals.uploaded_bytes, 500);
    }

    #[test]
    fn a_queued_row_that_never_reached_an_engine_is_the_one_waiting_to_start() {
        let pool = seed();
        let mut started = download("d_started", "queued", 5);
        started.client_ref = "already-added".into();
        insert_download(&pool, &started).unwrap();
        let conn = pool.get().unwrap();

        let waiting: Vec<String> = queued_downloads(&conn)
            .unwrap()
            .into_iter()
            .filter(|row| row.client_ref.is_empty())
            .map(|row| row.id)
            .collect();

        assert_eq!(waiting, ["d_q"]);
    }

    #[test]
    fn only_rows_holding_an_engine_slot_count_against_the_parallelism_cap() {
        let pool = seed();
        let conn = pool.get().unwrap();

        assert_eq!(running_download_count(&conn).unwrap(), 2);
        assert_eq!(
            queued_downloads(&conn)
                .unwrap()
                .iter()
                .map(|d| d.id.as_str())
                .collect::<Vec<_>>(),
            ["d_q"]
        );
    }

    #[test]
    fn unlinked_keeps_only_the_rows_no_title_was_pinned_to() {
        let pool = test_db();
        let mut linked = download("linked", "queued", 10);
        linked.tmdb_id = 1399;
        let mut orphan = download("orphan", "queued", 20);
        orphan.tmdb_id = 0;
        insert_download(&pool, &linked).unwrap();
        insert_download(&pool, &orphan).unwrap();
        let conn = pool.get().unwrap();

        let filter = DownloadFilter {
            unlinked: true,
            ..DownloadFilter::default()
        };

        assert_eq!(count_downloads(&conn, &filter).unwrap(), 1);
        assert_eq!(page_downloads(&conn, &filter, 0, 25).unwrap()[0].id, "orphan");
    }
}
