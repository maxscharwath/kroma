//! The server's own machinery: settings, jobs, alerts, reports.

pub(super) const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- Background job system (see services::jobs). Per-job schedule overrides,
    -- one row per execution, and per-run log lines.
    CREATE TABLE IF NOT EXISTS job_schedules (
        key        TEXT PRIMARY KEY,
        schedule   TEXT,
        enabled    INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_runs (
        id             TEXT PRIMARY KEY,
        job_key        TEXT NOT NULL,
        trigger_kind   TEXT NOT NULL,
        status         TEXT NOT NULL,
        started_at     INTEGER NOT NULL,
        finished_at    INTEGER,
        progress_done  INTEGER,
        progress_total INTEGER,
        error          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_job_runs_key ON job_runs(job_key, started_at DESC);
    CREATE TABLE IF NOT EXISTS job_logs (
        run_id  TEXT NOT NULL,
        ts      INTEGER NOT NULL,
        level   TEXT NOT NULL,
        message TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_job_logs_run ON job_logs(run_id, ts);

    -- Per-element processing ledger (see services::pipeline): one row per
    -- (stage, subject). `input_sig` is a cheap signature of the subject's inputs,
    -- so unchanged + `status='done'` skips work and a changed one re-queues it.
    CREATE TABLE IF NOT EXISTS pipeline_tasks (
        stage        TEXT NOT NULL,
        subject_kind TEXT NOT NULL,
        subject_id   TEXT NOT NULL,
        status       TEXT NOT NULL,
        input_sig    TEXT,
        attempts     INTEGER NOT NULL DEFAULT 0,
        priority     INTEGER NOT NULL DEFAULT 0,
        error        TEXT,
        enqueued_at  INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL,
        started_at   INTEGER,
        finished_at  INTEGER,
        duration_ms  INTEGER,
        -- Earliest epoch-ms a `failed` task may be auto-retried (exponential
        -- backoff, set by `finish_batch`). NULL = no gate. Manual retry /
        -- reprocess / enqueue always clear it.
        next_retry_at INTEGER,
        PRIMARY KEY (stage, subject_kind, subject_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pipeline_ready
        ON pipeline_tasks(stage, status, priority DESC, enqueued_at);
    -- Seek by (stage, subject_id) for the show/item roll-up (`worst_status`): the
    -- PK is (stage, subject_kind, subject_id), so subject_id can't be sought
    -- without this composite index.
    CREATE INDEX IF NOT EXISTS idx_pipeline_subject
        ON pipeline_tasks(stage, subject_id);

    -- User-submitted problem reports. `subject_id` is a movie/episode item id OR
    -- a show id (no items FK, same rationale as `watched`/`my_list`), and
    -- `subject_title` is snapshotted so the queue survives a re-scan/deletion.
    CREATE TABLE IF NOT EXISTS reports (
        id            TEXT PRIMARY KEY,
        subject_kind  TEXT NOT NULL,
        subject_id    TEXT NOT NULL,
        subject_title TEXT NOT NULL,
        category      TEXT NOT NULL,
        message       TEXT,
        status        TEXT NOT NULL DEFAULT 'open',
        reported_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
        resolved_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
        resolved_at   INTEGER,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reports_status  ON reports(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_subject ON reports(subject_kind, subject_id);
    CREATE INDEX IF NOT EXISTS idx_reports_user    ON reports(reported_by, created_at DESC);

    -- One row per (user, thing that happened). The text is NOT stored: `title_key`
    -- / `body_key` are i18n keys, rendered against the reader's locale on the way
    -- out, so switching language re-reads the whole history in the new one.
    -- `push_category` names a UNNotificationCategory (APNs can't render arbitrary
    -- buttons, so native push picks from a fixed set) while `actions` stays the
    -- full-fidelity in-app form. `category` is derived from `event` but stored,
    -- so the prefs filter and the UI grouping are one indexed column.
    CREATE TABLE IF NOT EXISTS notifications (
        id            TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category      TEXT NOT NULL,
        event         TEXT NOT NULL,
        title_key     TEXT NOT NULL,
        body_key      TEXT NOT NULL,
        params        TEXT NOT NULL DEFAULT '{}',
        link          TEXT,
        image_url     TEXT,
        actions       TEXT NOT NULL DEFAULT '[]',
        push_category TEXT,
        read_at       INTEGER,
        created_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
    -- Partial index: the bell badge counts unread only, and unread is the small
    -- side of the table (rows are marked read and then aged out).
    CREATE INDEX IF NOT EXISTS idx_notifications_unread
        ON notifications(user_id) WHERE read_at IS NULL;

    -- Per-user delivery matrix. A MISSING row means 'on' for both channels, so a
    -- newly added category starts enabled without backfilling every user, and
    -- only deviations from the default cost a row.
    CREATE TABLE IF NOT EXISTS notification_prefs (
        user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        in_app   INTEGER NOT NULL DEFAULT 1,
        push     INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, category)
    );

    -- One row per push endpoint. For Web Push `endpoint` is the push service URL
    -- and `p256dh`/`auth` are the subscription's client keys (RFC 8291); for the
    -- native transports `endpoint` is the raw device token and both are NULL.
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transport  TEXT NOT NULL,
        endpoint   TEXT NOT NULL,
        p256dh     TEXT,
        auth       TEXT,
        device     TEXT,
        locale     TEXT,
        failures   INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_ok_at INTEGER,
        UNIQUE (transport, endpoint)
    );
    CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
";
