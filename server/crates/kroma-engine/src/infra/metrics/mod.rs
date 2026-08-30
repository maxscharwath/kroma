//! System metrics sampler: the data behind the dashboard's Débit / Processeur /
//! RAM charts and the Stockage page.
//!
//! A background task samples CPU + RAM via `sysinfo` every [`SAMPLE_INTERVAL`]
//! and keeps a rolling ring buffer (~[`HISTORY`] samples ≈ the design's 6-minute
//! window). The KROMA figures cover the whole process TREE (see [`tree`]),
//! because every transcode is a child ffmpeg and a server that reported only
//! itself read as idle while it saturated the box.
//!
//! Bandwidth is the REAL throughput: the media-delivery handlers feed every byte
//! they stream into cumulative LAN/WAN counters (via [`ByteSink`]), and each tick
//! converts the byte delta over the elapsed interval into Mb/s. That tracks what
//! is actually on the wire (buffering bursts, transcode throttling,
//! paused-but-buffered clients), unlike a nominal per-title bitrate. Disk usage
//! is read on demand for the storage page.

mod disks;
mod tree;

use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use sysinfo::System;

use crate::process_started;

pub use disks::{read_disks, DiskInfo};

// 3s still reads as live on the dashboard while keeping the permanent
// background procfs churn low; this loop runs forever, viewer or not, so it
// must be near-free on a weak NAS.
const SAMPLE_INTERVAL: Duration = Duration::from_millis(3000);
// Ring-buffer length (≈ 6 min at 3s/sample; the dashboard shows the tail).
const HISTORY: usize = 120;

/// Time-series history (oldest → newest). Percentages are 0..100.
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Series {
    pub cpu_kroma: Vec<f32>,
    pub cpu_system: Vec<f32>,
    /// The child-process share of `cpu_kroma`: on this server, ffmpeg.
    pub cpu_media: Vec<f32>,
    pub ram_kroma: Vec<f32>,
    pub ram_system: Vec<f32>,
    pub bw_local: Vec<f64>,
    pub bw_remote: Vec<f64>,
}

/// A point-in-time metrics snapshot plus the recent history series.
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    /// The whole process tree, not the server process alone.
    pub cpu_kroma: f32,
    pub cpu_system: f32,
    /// What the ffmpeg children alone are costing, out of `cpu_kroma`.
    pub cpu_media: f32,
    /// How many child processes the server is holding open.
    pub media_procs: usize,
    pub ram_kroma_bytes: u64,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub bw_local_mbps: f64,
    pub bw_remote_mbps: f64,
    pub uptime_secs: u64,
    pub cores: usize,
    // So the client's chart labels the time axis with the server's real
    // interval instead of a hardcoded (drift-prone) one.
    pub sample_interval_ms: u64,
    pub series: Series,
}

// Cumulative bytes delivered by the media handlers, split by client network
// class. Monotonic; the sampler reads deltas between ticks. Cloning shares
// the same atomics (both the `Metrics` handle and every `ByteSink` point here).
#[derive(Clone, Default)]
struct Bytes {
    lan: Arc<AtomicU64>,
    wan: Arc<AtomicU64>,
}

/// A cheap, cloneable handle a streaming response adds its delivered bytes to.
/// `Metrics::sink` hands out the LAN or WAN counter for a request; an empty sink
/// (`ByteSink::none`) is a no-op, for byte streams that shouldn't count toward
/// media bandwidth (e.g. UI theme songs).
#[derive(Clone, Default)]
pub struct ByteSink(Option<Arc<AtomicU64>>);

impl ByteSink {
    /// A sink that discards its counts (not attributed to any bandwidth series).
    pub fn none() -> Self {
        ByteSink(None)
    }

    pub fn add(&self, n: u64) {
        if let Some(c) = &self.0 {
            c.fetch_add(n, Ordering::Relaxed);
        }
    }
}

#[derive(Default)]
struct Hist {
    cpu_kroma: VecDeque<f32>,
    cpu_system: VecDeque<f32>,
    cpu_media: VecDeque<f32>,
    ram_kroma: VecDeque<f32>,
    ram_system: VecDeque<f32>,
    bw_local: VecDeque<f64>,
    bw_remote: VecDeque<f64>,
    by_pid: HashMap<u32, f32>,
    cur: Snapshot,
}

/// Shared, cheap-to-clone handle to the rolling metrics history.
#[derive(Clone)]
pub struct Metrics {
    inner: Arc<RwLock<Hist>>,
    bytes: Bytes,
}

impl Metrics {
    pub fn new() -> Self {
        Metrics {
            inner: Arc::new(RwLock::new(Hist::default())),
            bytes: Bytes::default(),
        }
    }

    /// A byte sink for a request, targeting the LAN or WAN throughput counter.
    /// The streaming handler passes it to the media response so every delivered
    /// byte is metered into the dashboard's bandwidth chart.
    pub fn sink(&self, is_lan: bool) -> ByteSink {
        ByteSink(Some(if is_lan {
            self.bytes.lan.clone()
        } else {
            self.bytes.wan.clone()
        }))
    }

    /// Current values + the recent history series, for `GET /api/admin/metrics`.
    pub fn snapshot(&self) -> Snapshot {
        let h = self.inner.read().unwrap();
        let mut snap = h.cur.clone();
        snap.uptime_secs = process_started().elapsed().as_secs();
        snap.sample_interval_ms = SAMPLE_INTERVAL.as_millis() as u64;
        snap.series = Series {
            cpu_kroma: h.cpu_kroma.iter().copied().collect(),
            cpu_system: h.cpu_system.iter().copied().collect(),
            cpu_media: h.cpu_media.iter().copied().collect(),
            ram_kroma: h.ram_kroma.iter().copied().collect(),
            ram_system: h.ram_system.iter().copied().collect(),
            bw_local: h.bw_local.iter().copied().collect(),
            bw_remote: h.bw_remote.iter().copied().collect(),
        };
        snap
    }

    /// What one child process is costing the box, as a percentage of it. Lets a
    /// caller holding a pid (a live remux) say what that remux is spending,
    /// rather than only what the tree spends together.
    pub fn process_cpu(&self, pid: u32) -> Option<f32> {
        self.inner.read().unwrap().by_pid.get(&pid).copied()
    }

    fn push(&self, snap: Snapshot, ram_kroma_pct: f32, ram_sys_pct: f32, by_pid: HashMap<u32, f32>) {
        let mut h = self.inner.write().unwrap();
        push_cap(&mut h.cpu_kroma, snap.cpu_kroma);
        push_cap(&mut h.cpu_system, snap.cpu_system);
        push_cap(&mut h.cpu_media, snap.cpu_media);
        push_cap(&mut h.ram_kroma, ram_kroma_pct);
        push_cap(&mut h.ram_system, ram_sys_pct);
        push_cap(&mut h.bw_local, snap.bw_local_mbps);
        push_cap(&mut h.bw_remote, snap.bw_remote_mbps);
        h.by_pid = by_pid;
        h.cur = snap;
    }

    /// Spawn the sampler. Bandwidth is the real byte delta on the LAN/WAN
    /// counters (fed by [`ByteSink`] from the media handlers) over each interval.
    pub fn spawn_sampler(&self) {
        let metrics = self.clone();
        // sysinfo work is blocking-ish but cheap; a dedicated OS thread keeps it
        // off the async runtime and lets us sleep precisely.
        std::thread::spawn(move || {
            let mut sys = System::new();
            let cores = num_cpus_safe(&mut sys);
            let mut tree = tree::Tree::new();
            let mut last_lan = metrics.bytes.lan.load(Ordering::Relaxed);
            let mut last_wan = metrics.bytes.wan.load(Ordering::Relaxed);
            let mut last_at = Instant::now();
            loop {
                sys.refresh_cpu_usage();
                sys.refresh_memory();
                let usage = tree.sample(&mut sys, cores);

                let cpu_system = sys.global_cpu_usage();
                let ram_total = sys.total_memory().max(1);
                let ram_used = sys.used_memory();
                let ram_sys_pct = (ram_used as f32 / ram_total as f32) * 100.0;
                let ram_kroma_pct = (usage.ram_bytes as f32 / ram_total as f32) * 100.0;

                // Bytes delivered since the previous tick / real elapsed time →
                // Mb/s. `wrapping_sub` is just defensive; the counters only grow.
                let lan_now = metrics.bytes.lan.load(Ordering::Relaxed);
                let wan_now = metrics.bytes.wan.load(Ordering::Relaxed);
                let dt = last_at.elapsed().as_secs_f64();
                let (bw_local, bw_remote) = if dt > 0.0 {
                    (
                        mbps(lan_now.wrapping_sub(last_lan), dt),
                        mbps(wan_now.wrapping_sub(last_wan), dt),
                    )
                } else {
                    (0.0, 0.0)
                };
                last_lan = lan_now;
                last_wan = wan_now;
                last_at = Instant::now();

                metrics.push(
                    Snapshot {
                        cpu_kroma: usage.cpu,
                        cpu_system,
                        cpu_media: usage.children_cpu,
                        media_procs: usage.children,
                        ram_kroma_bytes: usage.ram_bytes,
                        ram_used_bytes: ram_used,
                        ram_total_bytes: ram_total,
                        bw_local_mbps: bw_local,
                        bw_remote_mbps: bw_remote,
                        uptime_secs: 0,
                        cores: cores as usize,
                        sample_interval_ms: 0,
                        series: Series::default(),
                    },
                    ram_kroma_pct,
                    ram_sys_pct,
                    usage.by_pid,
                );

                std::thread::sleep(SAMPLE_INTERVAL);
            }
        });
    }
}

fn mbps(bytes: u64, dt: f64) -> f64 {
    (bytes as f64) * 8.0 / dt / 1_000_000.0
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

fn push_cap<T>(buf: &mut VecDeque<T>, v: T) {
    if buf.len() >= HISTORY {
        buf.pop_front();
    }
    buf.push_back(v);
}

fn num_cpus_safe(sys: &mut System) -> f32 {
    sys.refresh_cpu_all();
    let n = sys.cpus().len();
    if n == 0 {
        1.0
    } else {
        n as f32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mbps_converts_bytes_over_time() {
        // 1 MB delivered over 1 s = 8 Mb/s.
        assert!((mbps(1_000_000, 1.0) - 8.0).abs() < 1e-9);
        // Same bytes over 2 s = half the rate.
        assert!((mbps(1_000_000, 2.0) - 4.0).abs() < 1e-9);
        assert_eq!(mbps(0, 3.0), 0.0);
    }

    #[test]
    fn sink_routes_bytes_to_the_right_counter() {
        let m = Metrics::new();
        m.sink(true).add(1_000);
        m.sink(true).add(500);
        m.sink(false).add(200);
        assert_eq!(m.bytes.lan.load(Ordering::Relaxed), 1_500);
        assert_eq!(m.bytes.wan.load(Ordering::Relaxed), 200);
    }

    #[test]
    fn empty_sink_is_a_noop() {
        ByteSink::none().add(9_999);
        ByteSink::default().add(9_999);
    }

    #[test]
    fn snapshot_reports_the_sample_interval() {
        let m = Metrics::new();
        assert_eq!(
            m.snapshot().sample_interval_ms,
            SAMPLE_INTERVAL.as_millis() as u64
        );
    }

    #[test]
    fn one_childs_cost_can_be_read_back_by_its_pid() {
        let m = Metrics::new();

        m.push(Snapshot::default(), 0.0, 0.0, HashMap::from([(4242, 87.5)]));

        assert_eq!(m.process_cpu(4242), Some(87.5));
        assert_eq!(m.process_cpu(1), None);
    }

    #[test]
    fn the_media_share_is_kept_beside_the_tree_it_belongs_to() {
        let m = Metrics::new();

        m.push(
            Snapshot {
                cpu_kroma: 62.0,
                cpu_media: 58.0,
                media_procs: 2,
                ..Snapshot::default()
            },
            0.0,
            0.0,
            HashMap::new(),
        );

        let snap = m.snapshot();
        assert_eq!(snap.cpu_media, 58.0);
        assert_eq!(snap.media_procs, 2);
        assert_eq!(snap.series.cpu_media, vec![58.0]);
    }
}
