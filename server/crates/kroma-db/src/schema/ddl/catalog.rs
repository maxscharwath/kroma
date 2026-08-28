//! The library itself: what was scanned, and what plays.

pub(super) const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS libraries (
        id        TEXT PRIMARY KEY,
        name      TEXT NOT NULL,
        kind      TEXT NOT NULL,
        path      TEXT NOT NULL,
        added_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shows (
        id        TEXT PRIMARY KEY,
        library   TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        title     TEXT NOT NULL,
        year      INTEGER,
        metadata  TEXT,
        added_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS items (
        id            TEXT PRIMARY KEY,
        kind          TEXT NOT NULL,
        title         TEXT NOT NULL,
        year          INTEGER,
        duration_ms   INTEGER,
        container     TEXT NOT NULL,
        v_codec       TEXT,
        v_width       INTEGER,
        v_height      INTEGER,
        v_hdr         INTEGER,
        v_bit_depth   INTEGER,
        a_codec       TEXT,
        a_channels    INTEGER,
        a_language    TEXT,
        subtitles     TEXT NOT NULL DEFAULT '[]',
        library       TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        show_id       TEXT REFERENCES shows(id) ON DELETE CASCADE,
        show_title    TEXT,
        season        INTEGER,
        episode       INTEGER,
        episode_end   INTEGER,
        episode_title TEXT,
        rel_path      TEXT,
        abs_path      TEXT,
        metadata      TEXT,
        added_at      TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
        id          TEXT PRIMARY KEY,
        item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        abs_path    TEXT NOT NULL UNIQUE,
        rel_path    TEXT,
        container   TEXT NOT NULL DEFAULT '',
        size        INTEGER,
        mtime       INTEGER,
        edition     TEXT,
        duration_ms INTEGER,
        v_codec     TEXT,
        v_width     INTEGER,
        v_height    INTEGER,
        v_hdr       INTEGER,
        v_bit_depth INTEGER,
        a_codec     TEXT,
        a_channels  INTEGER,
        a_language  TEXT,
        audio_tracks TEXT NOT NULL DEFAULT '[]',
        subtitles   TEXT NOT NULL DEFAULT '[]',
        probed      INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_items_library ON items(library);
    CREATE INDEX IF NOT EXISTS idx_items_kind    ON items(kind);
    CREATE INDEX IF NOT EXISTS idx_items_show    ON items(show_id, season, episode);
    CREATE INDEX IF NOT EXISTS idx_items_added   ON items(added_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shows_library ON shows(library);
    CREATE INDEX IF NOT EXISTS idx_files_item    ON files(item_id);
    CREATE INDEX IF NOT EXISTS idx_files_abs     ON files(abs_path);
    CREATE INDEX IF NOT EXISTS idx_files_probed  ON files(probed);

    -- Skip-intro / next-up markers. One row per (item, kind); kind is
    -- 'intro' | 'credits' | …; bounds in ms.
    CREATE TABLE IF NOT EXISTS markers (
        item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        kind       TEXT NOT NULL,
        start_ms   INTEGER NOT NULL,
        end_ms     INTEGER NOT NULL,
        source     TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (item_id, kind)
    );

    -- EBU R128 loudness per (file, audio track), written by pipeline.loudness.
    -- Raw measured values are kept so playback-side remediation can reuse them.
    CREATE TABLE IF NOT EXISTS audio_analysis (
        file_id     TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        track_index INTEGER NOT NULL,
        lufs_i      REAL NOT NULL,
        lra         REAL NOT NULL,
        true_peak   REAL NOT NULL,
        dialog_lufs REAL,
        verdict     TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (file_id, track_index)
    );
    -- Per-season TMDB cast (the show's seasons are derived from items, so this
    -- holds the season-level credits keyed by (show, season number)).
    CREATE TABLE IF NOT EXISTS season_meta (
        show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        season  INTEGER NOT NULL,
        casts   TEXT NOT NULL,
        PRIMARY KEY (show_id, season)
    );

    -- Keyframe-derived HLS segment table per physical file (see infra::hls),
    -- computed lazily and revalidated by mtime/size/version.
    CREATE TABLE IF NOT EXISTS file_segments (
        file_id     TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
        mtime       INTEGER,
        size        INTEGER,
        version     INTEGER NOT NULL,
        duration_us INTEGER NOT NULL,
        v_codec     TEXT,
        segments    TEXT NOT NULL,
        updated_at  INTEGER NOT NULL
    );
";
