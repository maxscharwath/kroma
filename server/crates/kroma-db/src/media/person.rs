//! There is no person table: cast and crew live in each title's `metadata`
//! JSON, so a lookup reads every credit through SQLite's JSON1 and matches them
//! in Rust. Folding is why it cannot be a `WHERE`: a slug has already lost the
//! accents and punctuation an SQL comparison would need.

use anyhow::Result;
use rusqlite::Connection;

use kroma_domain::people::{self, Credit, CreditedTitle, PersonMatch};
use kroma_domain::slug::slugify;

use crate::Pool;

const MOVIE_CREDITS: &str = "\
    SELECT i.id, json_extract(c.value,'$.name'), json_extract(c.value,'$.tmdbId') \
      FROM items i, json_each(i.metadata,'$.cast') c \
     WHERE i.kind != 'episode' AND i.metadata IS NOT NULL \
    UNION ALL \
    SELECT i.id, json_extract(c.value,'$.name'), json_extract(c.value,'$.tmdbId') \
      FROM items i, json_each(i.metadata,'$.crew') c \
     WHERE i.kind != 'episode' AND i.metadata IS NOT NULL";

const SHOW_CREDITS: &str = "\
    SELECT s.id, json_extract(c.value,'$.name'), json_extract(c.value,'$.tmdbId') \
      FROM shows s, json_each(s.metadata,'$.cast') c \
     WHERE s.metadata IS NOT NULL \
    UNION ALL \
    SELECT s.id, json_extract(c.value,'$.name'), json_extract(c.value,'$.tmdbId') \
      FROM shows s, json_each(s.metadata,'$.crew') c \
     WHERE s.metadata IS NOT NULL";

/// The person `lookup` names, with the movies and shows crediting them.
/// `lookup` is a provider person id, a URL slug, or a display name in any
/// casing; see [`people::resolve_person`] for which one answers. Episodes are
/// excluded: they inherit their show's credits.
pub fn resolve_person(pool: &Pool, lookup: &str) -> Result<Option<PersonMatch>> {
    if slugify(lookup).is_empty() {
        return Ok(None);
    }
    let conn = pool.get()?;
    let mut credits = read_credits(&conn, MOVIE_CREDITS, CreditedTitle::Movie)?;
    credits.extend(read_credits(&conn, SHOW_CREDITS, CreditedTitle::Show)?);
    Ok(people::resolve_person(credits, lookup))
}

fn read_credits(
    conn: &Connection,
    sql: &str,
    title: fn(String) -> CreditedTitle,
) -> Result<Vec<Credit>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, Option<String>>(1)?,
            r.get::<_, Option<i64>>(2)?,
        ))
    })?;
    let mut credits = Vec::new();
    for row in rows {
        let (title_id, name, tmdb_id) = row?;
        if let Some(name) = name {
            credits.push(Credit {
                name,
                tmdb_id: tmdb_id.and_then(|id| u64::try_from(id).ok()),
                title: title(title_id),
            });
        }
    }
    Ok(credits)
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::media::test_support::pool;
    use crate::testing::TempPool;
    use rusqlite::params;

    type Credited<'a> = (&'a str, Option<u64>);

    fn credits(cast: &[Credited], crew: &[Credited]) -> String {
        let person = |(name, id): &Credited| serde_json::json!({"name": name, "tmdbId": id});
        serde_json::json!({
            "tmdbId": 1,
            "tmdbUrl": "x",
            "genres": [],
            "cast": cast.iter().map(person).collect::<Vec<_>>(),
            "crew": crew.iter().map(person).collect::<Vec<_>>(),
        })
        .to_string()
    }

    fn seeded_pool() -> TempPool {
        let pool = pool();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO libraries (id,name,kind,path,added_at) VALUES ('lib','L','movie','/x','t')",
            [],
        )
        .unwrap();
        let movie = |id: &str, cast: &[Credited], crew: &[Credited]| {
            conn.execute(
                "INSERT INTO items (id,kind,title,container,library,added_at,metadata) \
                 VALUES (?1,'movie',?1,'mkv','lib','t',?2)",
                params![id, credits(cast, crew)],
            )
            .unwrap();
        };
        movie(
            "m1",
            &[("Timothée Chalamet", Some(1234))],
            &[("Denis Villeneuve", None)],
        );
        movie(
            "m2",
            &[("Emily Blunt", None)],
            &[("Denis Villeneuve", None)],
        );
        conn.execute(
            "INSERT INTO shows (id,library,title,added_at,metadata) VALUES ('s1','lib','S','t',?1)",
            params![credits(&[("Adam Scott", None)], &[("Ben Stiller", None)])],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO items (id,kind,title,container,library,show_id,season,episode,added_at,metadata) \
             VALUES ('e1','episode','Ep1','mkv','lib','s1',1,1,'t',?1)",
            params![credits(&[("Adam Scott", None)], &[])],
        )
        .unwrap();
        drop(conn);
        pool
    }

    #[test]
    fn a_slug_finds_every_movie_and_show_crediting_the_person_it_names() {
        let pool = seeded_pool();

        let director = resolve_person(&pool, "denis-villeneuve").unwrap().unwrap();
        let actor = resolve_person(&pool, "timothee-chalamet").unwrap().unwrap();

        assert_eq!(director.name, "Denis Villeneuve");
        assert_eq!(director.movie_ids, ["m1", "m2"]);
        assert!(director.show_ids.is_empty());
        assert_eq!(actor.movie_ids, ["m1"]);
    }

    #[test]
    fn a_credit_on_a_show_never_drags_in_its_episodes() {
        let pool = seeded_pool();

        let found = resolve_person(&pool, "adam-scott").unwrap().unwrap();

        assert_eq!(found.show_ids, ["s1"]);
        assert!(found.movie_ids.is_empty());
    }

    #[test]
    fn a_display_name_finds_what_its_slug_finds_so_older_clients_keep_working() {
        let pool = seeded_pool();

        let by_name = resolve_person(&pool, "Timothée Chalamet").unwrap();

        assert_eq!(by_name, resolve_person(&pool, "timothee-chalamet").unwrap());
    }

    #[test]
    fn a_stored_person_id_answers_on_its_own() {
        let pool = seeded_pool();

        let found = resolve_person(&pool, "1234").unwrap().unwrap();

        assert_eq!(found.name, "Timothée Chalamet");
        assert_eq!(found.tmdb_id, Some(1234));
        assert_eq!(found.movie_ids, ["m1"]);
    }

    #[test]
    fn a_credit_stored_before_ids_were_kept_reports_none() {
        let pool = seeded_pool();

        let found = resolve_person(&pool, "denis-villeneuve").unwrap().unwrap();

        assert_eq!(found.tmdb_id, None);
    }

    #[test]
    fn an_uncredited_or_blank_lookup_finds_nobody() {
        let pool = seeded_pool();

        assert!(resolve_person(&pool, "Nobody").unwrap().is_none());
        assert!(resolve_person(&pool, "  ").unwrap().is_none());
    }
}
