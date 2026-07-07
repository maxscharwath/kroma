//! LUMA a self-hosted, direct-play media streaming server.
//!
//! Scans a media library (Plex-style movie/show detection), persists it in
//! SQLite, exposes metadata over a JSON REST API, and range-streams the original
//! files to clients. It never transcodes: clients decode HEVC/H.265/AV1
//! themselves. `ffprobe` is used only to read metadata.

mod api;
mod config;
mod db;
mod domain;
mod i18n;
mod infra;
mod model;
mod services;
mod state;

use std::sync::OnceLock;
use std::time::Instant;

use anyhow::Context;
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::config::Config;
use crate::state::AppState;

// On the Linux/musl single binary, musl's malloc is a global-lock design that
// collapses under our thread mix (tokio workers + rayon walks + candle tensors);
// mimalloc removes that contention. macOS dev keeps the system allocator.
#[cfg(target_os = "linux")]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

/// Process start time, for the admin "Disponibilité" / uptime readout.
static PROCESS_START: OnceLock<Instant> = OnceLock::new();

/// When this process started (monotonic). Seeded on first call.
pub fn process_started() -> Instant {
    *PROCESS_START.get_or_init(Instant::now)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    process_started();
    let config = Config::from_env();
    // Keep the appender guard alive for the whole process so buffered log lines
    // are flushed to disk.
    let _log_guard = init_tracing(&config.logs_dir());

    info!(
        host = %config.host,
        port = config.port,
        media_dirs = config.media_dirs.len(),
        db = %config.db_path().display(),
        "starting LUMA server"
    );

    let ffprobe_available = infra::probe::ffprobe_available();
    if ffprobe_available {
        info!("ffprobe detected: full metadata extraction enabled");
    } else {
        warn!("ffprobe not found: metadata will be inferred from file extensions");
    }

    if config.tmdb_api_key.is_some() {
        if infra::metadata::curl_available() {
            info!(language = %config.tmdb_language, "TMDB enrichment enabled");
        } else {
            warn!("LUMA_TMDB_API_KEY is set but `curl` was not found; TMDB enrichment disabled");
        }
    }

    let db = db::init(&config.db_path()).context("failed to initialise database")?;

    // Persisted settings (incl. the editable library definitions, seeded from
    // LUMA_MEDIA_DIRS on first run).
    let settings = services::settings::Settings::load(&db);

    let addr = config.socket_addr();
    let state = AppState::new(config, ffprobe_available, db, settings);

    // Refresh the library index in the background. The catalog already lives in
    // SQLite from the previous run and every read path serves from the DB, so we
    // must NOT block the listener on a fresh phase-1 scan: that scan is a
    // recursive `stat` walk of every media root, which on a NAS mount takes tens
    // of seconds (dominated by filesystem latency, not CPU). See
    // `spawn_startup_scan`: the walk + sync run off-thread and the usual phase-2
    // follow-ups fire when it lands.
    spawn_startup_scan(state.clone());

    // Background maintenance loops (independent of the library scan).
    // Reap idle HLS remux sessions (ffmpeg children + temp dirs).
    state.hls.spawn_reaper();

    // Live playback sessions: reap stale heartbeats → append to play history.
    state
        .playback
        .spawn_reaper(state.db.clone(), state.events.clone());

    // Sample CPU / RAM (and bandwidth from the playback registry) for the
    // admin dashboard charts.
    state.metrics.spawn_sampler(state.playback.clone());

    // Start the background-job cron scheduler (cache cleanup, recommendations
    // refresh, …). Manual + scheduled runs are tracked in the admin "Tâches" UI.
    state.jobs.clone().spawn_scheduler(state.clone());

    // Acquisition stack, off the critical path: bringing the WireGuard bridge up
    // and restoring in-flight torrents (fastresume) can each take a few seconds,
    // and neither is needed to serve requests, so spawn them rather than await
    // inline. Ordering inside the task is preserved: VPN first (so the embedded
    // engine's SOCKS5 URL points at a live proxy), then seed the embedded
    // engine's client row (compiled-in builds only; INSERT OR IGNORE keeps admin
    // edits), start the engine and the downloads monitor.
    {
        let state = state.clone();
        tokio::spawn(async move {
            state.vpn.apply(&state).await;
            if luma_torrents::RQBIT_COMPILED {
                let _ = db::insert_download_client(
                    &state.db,
                    &db::DownloadClientRow {
                        id: db::EMBEDDED_CLIENT_ID.to_string(),
                        kind: "rqbit".into(),
                        name: "Moteur intégré".into(),
                        url: String::new(),
                        username: String::new(),
                        password: String::new(),
                        enabled: true,
                        priority: 100,
                        created_at: services::jobs::now_ms(),
                    },
                );
                state.downloads.start_rqbit(&state).await;
            }
            state.downloads.spawn_monitor(state.clone());
        });
    }

    // Managed Cloudflare Tunnel connector: bring the tunnel up at boot if the admin
    // enabled it with a token (installs with their own tunnel leave it off), and
    // keep it alive via a watchdog. No-op otherwise.
    state.remote.clone().spawn_boot(state.clone());

    // mDNS advertising is a runtime-toggleable setting (Réseau → Découverte locale).
    let local_discovery = state.settings.get_bool("localDiscovery", true);

    let app = api::router(state);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind {addr}"))?;

    info!("LUMA listening on http://{addr}  (API under /api)");

    // Advertise over mDNS so LAN clients can auto-discover us, unless disabled in
    // settings. Best-effort: held alive until the process exits; failure (no
    // multicast, etc.) is non-fatal.
    let _mdns = if local_discovery {
        match infra::discovery::advertise(addr.port(), "LUMA") {
            Ok(daemon) => Some(daemon),
            Err(e) => {
                warn!(error = %e, "mDNS advertising unavailable; clients must use an explicit address");
                None
            }
        }
    } else {
        info!("local discovery (mDNS) disabled in settings");
        None
    };

    // `into_make_service_with_connect_info` so handlers can read the client's
    // socket address (LAN/WAN classification for playback sessions).
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await
    .context("server error")?;

    Ok(())
}

/// Refresh the on-disk library index in the background, then fire the phase-2
/// follow-ups (probe, search reindex, TMDB enrichment, filesystem watch).
///
/// Split out of `main` so the listener can bind and serve the already-persisted
/// catalog immediately. The blocking half (a recursive `stat` walk of every
/// media root plus the SQLite sync) runs on a blocking thread; the follow-ups,
/// which themselves spawn, run back on the async runtime once the sync lands.
fn spawn_startup_scan(state: crate::state::SharedState) {
    tokio::spawn(async move {
        let scan_state = state.clone();
        let data = match tokio::task::spawn_blocking(move || startup_scan_sync(&scan_state)).await {
            Ok(data) => data,
            Err(e) => {
                warn!(error = %e, "startup scan task failed");
                return;
            }
        };

        services::activity::scan_completed(
            &state.activity,
            data.libraries.len(),
            data.shows.len(),
            data.items.len(),
            services::scan::now_iso8601(),
        );

        // Phase 2 (probe, search reindex, TMDB enrichment) the same shared fan-out
        // that `POST /api/scan` and the `library.scan` job use.
        services::scan::spawn_follow_ups(&state, &data);

        // Watch the library for changes (periodic re-scan + filesystem events).
        // Baseline = the scan we just applied, so it stays quiet until something
        // actually changes.
        infra::watch::spawn(state.clone(), infra::watch::signature(&data.items, &data.mtimes));

        // Nudge any client that connected during the scan to refresh now that the
        // fresh index has landed.
        state
            .events
            .publish(crate::infra::events::ServerEvent::LibraryUpdated);
    });
}

/// Blocking half of the startup scan: the shared phase-1 walk + guarded SQLite
/// sync ([`services::scan::rescan_sync`], which owns the demo-seed and
/// mount-outage guards). Returns the scanned [`services::scan::ScanData`] (empty
/// on a mount outage / sync error, so the watcher baseline stays 0 and recovery
/// re-syncs once the mount returns).
fn startup_scan_sync(state: &crate::state::SharedState) -> services::scan::ScanData {
    let started = Instant::now();
    match services::scan::rescan_sync(state) {
        Ok(data) => {
            info!(
                libraries = data.libraries.len(),
                shows = data.shows.len(),
                items = data.items.len(),
                elapsed_ms = started.elapsed().as_millis() as u64,
                "library index ready (phase 1)"
            );
            data
        }
        Err(e) => {
            warn!(error = %format!("{e:#}"), "startup library sync failed; keeping the existing index");
            services::scan::ScanData::default()
        }
    }
}

/// Initialise tracing. Honours `RUST_LOG`, defaulting to info-level for our
/// crate. Logs to stdout **and** a daily-rolling file under `<data>/logs/`
/// (best-effort). Returns the appender guard, which must be held for the process
/// lifetime so buffered lines flush.
fn init_tracing(log_dir: &std::path::Path) -> Option<tracing_appender::non_blocking::WorkerGuard> {
    // `librqbit=info` surfaces the embedded engine's tracker announces + peer
    // connection errors (why a torrent finds no peers). Bump to
    // `RUST_LOG=librqbit=debug` for the full swarm chatter.
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new("luma_server=info,tower_http=info,axum=info,librqbit=info")
    });

    // Best-effort rolling file layer (no ANSI colour codes on disk).
    let (file_layer, guard) = match std::fs::create_dir_all(log_dir) {
        Ok(()) => {
            let appender = tracing_appender::rolling::daily(log_dir, "luma.log");
            let (writer, guard) = tracing_appender::non_blocking(appender);
            let layer = tracing_subscriber::fmt::layer()
                .with_ansi(false)
                .with_writer(writer);
            (Some(layer), Some(guard))
        }
        Err(e) => {
            // Tracing isn't initialised yet, so report to stderr directly.
            eprintln!(
                "warning: could not create log dir {} ({e}); file logging disabled",
                log_dir.display()
            );
            (None, None)
        }
    };

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .with(file_layer)
        .init();

    guard
}
