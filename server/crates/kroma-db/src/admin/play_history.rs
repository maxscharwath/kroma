//! The play log, and the analytics read off it.

use anyhow::Result;
use kroma_domain::{PlayEntry, PlayRecord};
use rusqlite::{params, Row};

use crate::rows::parse_kind;
use crate::Pool;

/// Append one finished playback to the history log.
pub fn record_play(pool: &Pool, play: &PlayRecord) -> Result<()> {
    let conn = pool.get()?;
    let id = kroma_primitives::short_hash(&format!(
        "play|{}|{}|{}|{}",
        play.user_id.as_deref().unwrap_or("?"),
        play.item_id.as_deref().unwrap_or("?"),
        play.started_at,
        kroma_primitives::random_token()
    ));
    conn.execute(
        "INSERT INTO play_history \
         (id,user_id,username,item_id,kind,title,library,started_at,ended_at,watched_ms,\
          device,player,mode,network,video_label,audio_label,show_title,season,episode) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)",
        params![
            id,
            play.user_id,
            play.username,
            play.item_id,
            play.kind,
            play.title,
            play.library,
            play.started_at,
            play.ended_at,
            play.watched_ms,
            play.device,
            play.player,
            play.mode,
            play.network,
            play.video_label,
            play.audio_label,
            play.show_title,
            play.season,
            play.episode,
        ],
    )?;
    Ok(())
}

/// Per-user watch aggregates since `since` (unix-seconds), best watchers first.
pub fn top_users(pool: &Pool, since: i64, limit: usize) -> Result<Vec<kroma_domain::TopUser>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT COALESCE(username,'?') AS u, COUNT(*) AS plays, \
            SUM(watched_ms) AS total, \
            SUM(CASE WHEN kind='movie' THEN watched_ms ELSE 0 END) AS films, \
            SUM(CASE WHEN kind IN ('episode','video') THEN watched_ms ELSE 0 END) AS tv \
         FROM play_history WHERE ended_at >= ?1 \
         GROUP BY username ORDER BY total DESC LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![since, limit as i64], |r| {
        Ok(kroma_domain::TopUser {
            username: r.get(0)?,
            plays: r.get(1)?,
            watched_ms: r.get::<_, Option<i64>>(2)?.unwrap_or(0),
            films_ms: r.get::<_, Option<i64>>(3)?.unwrap_or(0),
            tv_ms: r.get::<_, Option<i64>>(4)?.unwrap_or(0),
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Raw history rows since `since` (unix-seconds) for client/server-side bucketing.
pub fn history_since(pool: &Pool, since: i64) -> Result<Vec<kroma_domain::HistoryRow>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT ended_at,kind,watched_ms FROM play_history WHERE ended_at >= ?1 ORDER BY ended_at",
    )?;
    let rows = stmt.query_map(params![since], |r| {
        Ok(kroma_domain::HistoryRow {
            ended_at: r.get(0)?,
            kind: parse_kind(&r.get::<_, String>(1)?),
            watched_ms: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

const COLUMNS: &str = "id,user_id,COALESCE(username,'?'),item_id,kind,title,show_title,\
                       season,episode,device,player,mode,network,video_label,audio_label,\
                       started_at,ended_at,watched_ms";

/// The watch log since `since` (unix-seconds), newest first: one row per finished
/// playback. `user` narrows it to one account, for the per-member view.
pub fn plays(
    pool: &Pool,
    since: i64,
    user: Option<&str>,
    limit: usize,
    offset: usize,
) -> Result<Vec<PlayEntry>> {
    let conn = pool.get()?;
    let sql = format!(
        "SELECT {COLUMNS} FROM play_history \
         WHERE ended_at >= ?1 AND (?2 IS NULL OR user_id = ?2) \
         ORDER BY ended_at DESC LIMIT ?3 OFFSET ?4"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![since, user, limit as i64, offset as i64], entry)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// How many rows [`plays`] would page through, for the table's footer.
pub fn plays_count(pool: &Pool, since: i64, user: Option<&str>) -> Result<i64> {
    let conn = pool.get()?;
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM play_history \
         WHERE ended_at >= ?1 AND (?2 IS NULL OR user_id = ?2)",
        params![since, user],
        |r| r.get(0),
    )?)
}

fn entry(r: &Row<'_>) -> rusqlite::Result<PlayEntry> {
    Ok(PlayEntry {
        id: r.get(0)?,
        user_id: r.get(1)?,
        username: r.get(2)?,
        item_id: r.get(3)?,
        kind: r.get(4)?,
        title: r.get(5)?,
        show_title: r.get(6)?,
        season: r.get(7)?,
        episode: r.get(8)?,
        device: r.get(9)?,
        player: r.get(10)?,
        mode: r.get(11)?,
        network: r.get(12)?,
        video_label: r.get(13)?,
        audio_label: r.get(14)?,
        started_at: r.get(15)?,
        ended_at: r.get(16)?,
        watched_ms: r.get(17)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::admin::test_support::*;

    fn play(user: &str, name: &str, title: &str, kind: &str, watched: i64) -> PlayRecord {
        PlayRecord {
            user_id: Some(user.into()),
            username: Some(name.into()),
            item_id: Some("m1".into()),
            kind: kind.into(),
            title: title.into(),
            watched_ms: watched,
            ended_at: 100,
            ..PlayRecord::default()
        }
    }

    #[test]
    fn play_history_aggregates() {
        let p = pool();
        record_play(&p, &play("u1", "alice", "Dune", "movie", 60_000)).unwrap();
        record_play(
            &p,
            &PlayRecord {
                ended_at: 200,
                ..play("u1", "alice", "Ep", "episode", 30_000)
            },
        )
        .unwrap();
        record_play(
            &p,
            &PlayRecord {
                ended_at: 150,
                ..play("u2", "bob", "Dune", "movie", 10_000)
            },
        )
        .unwrap();

        let top = top_users(&p, 0, 10).unwrap();
        assert_eq!(top.len(), 2);
        // alice watched 90s total > bob's 10s, so she ranks first.
        assert_eq!(top[0].username, "alice");
        assert_eq!(top[0].plays, 2);
        assert_eq!(top[0].watched_ms, 90_000);
        assert_eq!(top[0].films_ms, 60_000);
        assert_eq!(top[0].tv_ms, 30_000);

        // The `since` gate excludes older rows.
        assert!(top_users(&p, 1000, 10).unwrap().is_empty());
        assert_eq!(history_since(&p, 0).unwrap().len(), 3);
        assert!(history_since(&p, 1000).unwrap().is_empty());
    }

    #[test]
    fn the_log_keeps_the_device_and_the_treatment_the_stream_got() {
        let p = pool();

        record_play(
            &p,
            &PlayRecord {
                device: Some("Chrome · Windows".into()),
                player: Some("web".into()),
                mode: Some("transcode".into()),
                network: Some("WAN".into()),
                video_label: Some("1080p · H.265".into()),
                audio_label: Some("Surround · 5.1 · DTS".into()),
                show_title: Some("Severance".into()),
                season: Some(2),
                episode: Some(4),
                ..play("u1", "alice", "Chikhai Bardo", "episode", 42_000)
            },
        )
        .unwrap();

        let row = &plays(&p, 0, None, 50, 0).unwrap()[0];
        assert_eq!(row.device.as_deref(), Some("Chrome · Windows"));
        assert_eq!(row.mode.as_deref(), Some("transcode"));
        assert_eq!(row.network.as_deref(), Some("WAN"));
        assert_eq!(row.show_title.as_deref(), Some("Severance"));
        assert_eq!((row.season, row.episode), (Some(2), Some(4)));
        assert_eq!(row.watched_ms, 42_000);
    }

    #[test]
    fn the_log_reads_newest_first_and_pages() {
        let p = pool();
        for (n, ended) in [("first", 100), ("second", 200), ("third", 300)] {
            record_play(
                &p,
                &PlayRecord {
                    ended_at: ended,
                    ..play("u1", "alice", n, "movie", 1)
                },
            )
            .unwrap();
        }

        let page = plays(&p, 0, None, 2, 0).unwrap();

        assert_eq!(
            page.iter().map(|r| r.title.as_str()).collect::<Vec<_>>(),
            ["third", "second"]
        );
        assert_eq!(plays(&p, 0, None, 2, 2).unwrap()[0].title, "first");
        assert_eq!(plays_count(&p, 0, None).unwrap(), 3);
    }

    #[test]
    fn one_members_log_holds_only_their_own_plays() {
        let p = pool();
        record_play(&p, &play("u1", "alice", "Dune", "movie", 1)).unwrap();
        record_play(&p, &play("u2", "bob", "Arrival", "movie", 1)).unwrap();

        let alice = plays(&p, 0, Some("u1"), 50, 0).unwrap();

        assert_eq!(alice.len(), 1);
        assert_eq!(alice[0].title, "Dune");
        assert_eq!(plays_count(&p, 0, Some("u1")).unwrap(), 1);
        assert_eq!(plays_count(&p, 0, Some("nobody")).unwrap(), 0);
    }
}
