//! Who may watch, on which device, and how far they got.

pub(super) const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        username      TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url    TEXT,
        permissions   TEXT NOT NULL DEFAULT '[\"playback\"]',
        -- NULL = no preference; the client falls back to its own default.
        language          TEXT,
        audio_language    TEXT,
        -- An ISO code, or 'off'.
        subtitle_language TEXT,
        -- PBKDF2 hash with its own salt. NULL = the profile is not PIN-locked.
        pin_hash      TEXT,
        last_seen     TEXT,
        created_at    TEXT NOT NULL
    );
    -- Backstops the app-level username check against a check-then-write race.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        -- The access token this session was minted from, so an account can tell
        -- which listed device is making the current request.
        access_token TEXT
    );
    -- Long-lived per-device credential, exchanged for a short-lived session token
    -- via /auth/token. `pin_verified` gates PIN-locked accounts: set once the
    -- correct PIN is presented, letting silent refreshes skip re-prompting.
    CREATE TABLE IF NOT EXISTS access_tokens (
        token        TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at   TEXT NOT NULL,
        expires_at   INTEGER NOT NULL,
        pin_verified INTEGER NOT NULL DEFAULT 0,
        last_seen    TEXT,
        -- Captured when the token is minted, so the session list can label the device.
        user_agent   TEXT
    );
    -- One row per registered authenticator. `id` is the credential id
    -- (base64url); `credential` is the serialized webauthn-rs `Passkey`.
    CREATE TABLE IF NOT EXISTS passkeys (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        credential TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);
    CREATE TABLE IF NOT EXISTS progress (
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        position_ms INTEGER NOT NULL,
        duration_ms INTEGER,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (user_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS invites (
        token       TEXT PRIMARY KEY,
        permissions TEXT NOT NULL DEFAULT '[\"playback\"]',
        created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at  TEXT NOT NULL,
        expires_at  INTEGER NOT NULL,
        used_at     TEXT
    );
    -- `item_id` is a movie item id OR a show id; intentionally NOT an items FK
    -- so a show can be marked watched as a whole.
    CREATE TABLE IF NOT EXISTS watched (
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id    TEXT NOT NULL,
        watched_at TEXT NOT NULL,
        PRIMARY KEY (user_id, item_id)
    );
    -- Ma liste: user-bookmarked titles (movie item ids OR show ids; same
    -- no-items-FK rationale as `watched`). Synced across web + TV.
    CREATE TABLE IF NOT EXISTS my_list (
        user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id  TEXT NOT NULL,
        added_at TEXT NOT NULL,
        PRIMARY KEY (user_id, item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_watched_user  ON watched(user_id);
    CREATE INDEX IF NOT EXISTS idx_my_list_user  ON my_list(user_id, added_at DESC);
    CREATE TABLE IF NOT EXISTS play_history (
        id         TEXT PRIMARY KEY,
        user_id    TEXT,
        username   TEXT,
        item_id    TEXT,
        kind       TEXT NOT NULL,
        title      TEXT NOT NULL,
        library    TEXT,
        started_at INTEGER NOT NULL,
        ended_at   INTEGER NOT NULL,
        watched_ms INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_history_user  ON play_history(user_id, ended_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_ended ON play_history(ended_at DESC);

    -- Per-user LLM-generated taste profile plus the cached personalized home
    -- sections (JSON). See the `sections.personalize` job.
    CREATE TABLE IF NOT EXISTS user_taste (
        user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        profile    TEXT,
        sections   TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL
    );
";
