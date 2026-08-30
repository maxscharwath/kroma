//! Tables a MODULE owns, still held in the core database.
//!
//! None of these belong here: `requests`/`wanted`/`library_gaps`/`acq_file_tmdb`
//! are `tv.kroma.acquisition`, `downloads` is `tv.kroma.torrents`, `item_vectors`
//! is `tv.kroma.vector`, `whisper_jobs` is the `tv.kroma.whisper` progress channel.
//! Each module reaches them through the `storage.core` grant in its `module.json`
//! rather than from its own database file.
//!
//! They are grouped here rather than spread through the files above so the debt is
//! counted in one place. Moving one out is not a file move: every query over these
//! tables JOINs `files`/`items`/`shows`, which a module's private database cannot
//! reach.

pub(super) const SCHEMA: &str = "
    -- Subtitles fetched from an online provider, converted to WebVTT and cached
    -- under <data>/subs/downloaded/; merged into the item's subtitle list.
    CREATE TABLE IF NOT EXISTS downloaded_subtitles (
        id         TEXT PRIMARY KEY,
        item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        language   TEXT,
        label      TEXT NOT NULL,
        provider   TEXT NOT NULL,
        path       TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dl_subs_item ON downloaded_subtitles(item_id);
    CREATE TABLE IF NOT EXISTS item_vectors (
        id         TEXT PRIMARY KEY,
        dim        INTEGER NOT NULL,
        vec        BLOB NOT NULL,
        updated_at TEXT NOT NULL
    );
    -- Library missing-episode scan: aired TMDB episodes not on disk, recomputed
    -- by the library.missing job. Title/poster are denormalized to avoid a join.
    CREATE TABLE IF NOT EXISTS library_gaps (
        show_id     TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        tmdb_id     INTEGER NOT NULL,
        title       TEXT NOT NULL,
        poster_url  TEXT,
        season      INTEGER NOT NULL,
        episode     INTEGER NOT NULL,
        air_date    TEXT,
        detected_at INTEGER NOT NULL,
        PRIMARY KEY (show_id, season, episode)
    );

    -- Media requests (the 'ask for a title' flow). A show request may carry a
    -- season subset and/or an individual-episode subset (`episodes`); the target
    -- is their union. Linked to the catalog ONLY via tmdb_id: acquisition.match
    -- flips status once enrichment writes metadata.tmdbId for a local title.
    CREATE TABLE IF NOT EXISTS requests (
        id           TEXT PRIMARY KEY,
        kind         TEXT NOT NULL,
        tmdb_id      INTEGER NOT NULL,
        title        TEXT NOT NULL,
        year         INTEGER,
        poster_url   TEXT,
        seasons      TEXT,
        status       TEXT NOT NULL DEFAULT 'pending',
        requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_by  TEXT,
        note         TEXT,
        episodes     TEXT,
        -- Airing signals synced from TMDB by the acquisition.refresh job.
        -- NULL until the first refresh.
        air_status     TEXT,
        next_air_date  TEXT,
        last_refresh_at INTEGER,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_requests_ident  ON requests(kind, tmdb_id);
    CREATE INDEX IF NOT EXISTS idx_requests_user   ON requests(requested_by, created_at DESC);

    -- Episode-level wanted ledger, materialized when a request is approved.
    -- Season packs are computed at search time by grouping rows on (tmdb_id,
    -- season); there are no separate season rows.
    CREATE TABLE IF NOT EXISTS wanted (
        id             TEXT PRIMARY KEY,
        request_id     TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        kind           TEXT NOT NULL,
        tmdb_id        INTEGER NOT NULL,
        imdb_id        TEXT,
        title          TEXT NOT NULL,
        year           INTEGER,
        season         INTEGER,
        episode        INTEGER,
        air_date       TEXT,
        status         TEXT NOT NULL DEFAULT 'wanted',
        last_search_at INTEGER,
        search_attempts INTEGER NOT NULL DEFAULT 0,
        next_search_at INTEGER,
        updated_at     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wanted_request ON wanted(request_id);
    CREATE INDEX IF NOT EXISTS idx_wanted_ident   ON wanted(tmdb_id, season, episode);
    CREATE INDEX IF NOT EXISTS idx_wanted_due     ON wanted(status, next_search_at, air_date);

    -- The acquisition MODULE tables (`indexers`, `download_clients`, `downloads`)
    -- no longer live here: each is owned by its module crate and created at DB
    -- init via that module's `ServerModule::migrations`, run right after this
    -- core schema (so `downloads.request_id` can FK the `requests` table above).

    -- Known TMDB id for an acquired file, keyed by the ABSOLUTE PATH the import
    -- wrote it to: the import knows exactly where it placed the file, and the
    -- scanner records that same (canonicalized) path in `files.abs_path`, so the
    -- join is on ground truth and can never orphan on a title-parse difference
    -- (unlike guessing from the filename, e.g. Scary Movie vs A Scary Movie).
    CREATE TABLE IF NOT EXISTS acq_file_tmdb (
        abs_path  TEXT PRIMARY KEY,
        tmdb_id   INTEGER NOT NULL
    );

    -- The two SHARED tables below are written by a module and read by the core.
    -- They live here, in the core schema, because that is what they are: a
    -- module holds a grant on them, and a grant cannot create a table. A module
    -- table nothing outside it reads belongs in its own file instead (see
    -- kroma-db's `grant` and the supervisor's `adopt`).

    -- One row per grab: a release the downloads module sent to a client. The
    -- core reads it for the live progress overlay on request / discover lists,
    -- and `request_id` is a real foreign key into `requests`, so it could not
    -- live anywhere else. `client_id` has NO foreign key, so history survives a
    -- deleted client config.
    CREATE TABLE IF NOT EXISTS downloads (
        id              TEXT PRIMARY KEY,
        client_id       TEXT NOT NULL,
        client_ref      TEXT NOT NULL,
        request_id      TEXT REFERENCES requests(id) ON DELETE SET NULL,
        kind            TEXT NOT NULL,
        tmdb_id         INTEGER NOT NULL,
        title           TEXT,
        year            INTEGER,
        season          INTEGER,
        episodes        TEXT,
        release_title   TEXT NOT NULL,
        indexer_id      TEXT,
        info_hash       TEXT,
        magnet_or_url   TEXT NOT NULL,
        size_bytes      INTEGER,
        score           INTEGER,
        score_breakdown TEXT,
        status          TEXT NOT NULL DEFAULT 'queued',
        progress        REAL NOT NULL DEFAULT 0,
        save_path       TEXT,
        imported_paths  TEXT,
        error           TEXT,
        grabbed_at      INTEGER NOT NULL,
        completed_at    INTEGER,
        imported_at     INTEGER,
        details_url     TEXT,
        only_files      TEXT,
        upgrade         INTEGER NOT NULL DEFAULT 0,
        downloaded_bytes INTEGER NOT NULL DEFAULT 0,
        uploaded_bytes  INTEGER NOT NULL DEFAULT 0,
        match_source    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_downloads_status  ON downloads(status, grabbed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_downloads_req     ON downloads(request_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_grabbed ON downloads(grabbed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_downloads_client  ON downloads(client_id, grabbed_at DESC);

    -- The transcription progress channel. A whisper run is minutes long and
    -- drives live progress plus a mid-run cancel, which do not fit the buffered
    -- request/response the port bridge speaks: the core writes `cancel` and
    -- polls the rest, the sidecar does the reverse.
    CREATE TABLE IF NOT EXISTS whisper_jobs (
        id     TEXT PRIMARY KEY,
        stage  TEXT NOT NULL DEFAULT '',
        done   INTEGER NOT NULL DEFAULT 0,
        total  INTEGER NOT NULL DEFAULT 0,
        cancel INTEGER NOT NULL DEFAULT 0
    );
";
