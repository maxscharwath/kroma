use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};

use super::normalise::{self, MIN_BYTES};
use super::pipeline::{self, Event};
use super::source::ClipMeta;

/// How long a failure is remembered, so a client polling `prepare` sees the
/// error instead of starting the same doomed download again every second.
const FAILURE_COOLDOWN: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Default)]
pub struct Status {
    pub meta: Option<ClipMeta>,
    pub percent: u8,
    pub finished: bool,
    pub failed: Option<String>,
}

pub struct Job {
    pub final_path: PathBuf,
    state: Mutex<Status>,
    changed: Condvar,
    settled_at: Mutex<Option<Instant>>,
}

impl Job {
    pub fn status(&self) -> Status {
        self.state.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    /// Blocks until the clip's length is known, the copy is done, or it failed.
    /// The length comes from the source before the first byte, so this is the
    /// one wait a player has to sit through.
    pub fn wait_meta(&self, timeout: Duration) -> Status {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        let deadline = Instant::now() + timeout;
        while state.meta.is_none() && !state.finished && state.failed.is_none() {
            let now = Instant::now();
            if now >= deadline {
                break;
            }
            let (next, _) = self
                .changed
                .wait_timeout(state, deadline - now)
                .unwrap_or_else(|e| e.into_inner());
            state = next;
        }
        state.clone()
    }

    fn update(&self, f: impl FnOnce(&mut Status)) {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        f(&mut state);
        self.changed.notify_all();
    }
}

fn jobs() -> &'static Mutex<HashMap<String, Arc<Job>>> {
    static JOBS: OnceLock<Mutex<HashMap<String, Arc<Job>>>> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn is_complete(path: &Path) -> bool {
    normalise::file_len(path) >= MIN_BYTES
}

/// What is already known about one key, without starting anything. A cached
/// file is probed once per process, never once per request.
pub fn peek(data_dir: &Path, key: &str) -> Option<Arc<Job>> {
    if !super::cache::is_key_safe(key) {
        return None;
    }
    let final_path = super::cache::cached_path(data_dir, key);
    let mut map = jobs().lock().unwrap_or_else(|e| e.into_inner());
    known(&mut map, &final_path)
}

/// The job for one key, starting the download if nothing has it yet.
pub fn begin(data_dir: &Path, key: &str) -> Result<Arc<Job>, String> {
    if !super::cache::is_key_safe(key) {
        return Err("invalid trailer key".into());
    }
    let final_path = super::cache::cached_path(data_dir, key);
    let mut map = jobs().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(job) = known(&mut map, &final_path) {
        return Ok(job);
    }
    let job = Arc::new(Job {
        final_path: final_path.clone(),
        state: Mutex::new(Status::default()),
        changed: Condvar::new(),
        settled_at: Mutex::new(None),
    });
    map.insert(slot(&final_path), job.clone());
    drop(map);
    spawn_worker(data_dir, key, &final_path, &job)?;
    Ok(job)
}

/// One entry per cached file, not per YouTube key: two data dirs on one process
/// hold two different copies of the same clip.
fn slot(final_path: &Path) -> String {
    final_path.to_string_lossy().into_owned()
}

fn known(map: &mut HashMap<String, Arc<Job>>, final_path: &Path) -> Option<Arc<Job>> {
    let slot = slot(final_path);
    if let Some(job) = map.get(&slot).filter(|job| still_useful(job, final_path)) {
        return Some(job.clone());
    }
    map.remove(&slot);
    if !is_complete(final_path) {
        return None;
    }
    let job = settled(
        final_path.to_path_buf(),
        Status {
            meta: Some(normalise::measure(final_path)),
            percent: 100,
            finished: true,
            failed: None,
        },
    );
    map.insert(slot, job.clone());
    Some(job)
}

/// A cached entry is stale once the file it describes is gone, and a failure is
/// only worth repeating after a cooldown.
fn still_useful(job: &Arc<Job>, final_path: &Path) -> bool {
    let status = job.status();
    if !status.finished {
        return true;
    }
    if let Some(at) = *job.settled_at.lock().unwrap_or_else(|e| e.into_inner()) {
        if status.failed.is_some() {
            return at.elapsed() < FAILURE_COOLDOWN;
        }
    }
    status.failed.is_none() && is_complete(final_path)
}

fn settled(final_path: PathBuf, status: Status) -> Arc<Job> {
    Arc::new(Job {
        final_path,
        state: Mutex::new(status),
        changed: Condvar::new(),
        settled_at: Mutex::new(Some(Instant::now())),
    })
}

fn spawn_worker(
    data_dir: &Path,
    key: &str,
    final_path: &Path,
    job: &Arc<Job>,
) -> Result<(), String> {
    let worker = job.clone();
    let work = super::cache::work_dir(data_dir, key);
    let part = super::cache::part_path(data_dir, key);
    let spawn_key = key.to_string();
    std::thread::Builder::new()
        .name(format!("trailer-{key}"))
        .spawn(move || run(worker, spawn_key, work, part))
        .map(|_| ())
        .map_err(|e| {
            jobs()
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .remove(&slot(final_path));
            format!("could not start trailer download: {e}")
        })
}

fn run(job: Arc<Job>, key: String, work: PathBuf, part: PathBuf) {
    let mut on_event = |event: Event| match event {
        Event::Meta(meta) => job.update(|s| s.meta = Some(*meta)),
        Event::Percent(p) => job.update(|s| s.percent = p),
    };
    let result = pipeline::download(&key, &work, &part, &mut on_event)
        .and_then(|()| {
            std::fs::rename(&part, &job.final_path)
                .map_err(|e| format!("could not move trailer into place: {e}"))
        });
    let _ = std::fs::remove_dir_all(&work);
    if result.is_err() {
        let _ = std::fs::remove_file(&part);
    }
    let measured = result.is_ok().then(|| normalise::measure(&job.final_path));
    job.update(|s| {
        if let Some(meta) = measured {
            s.meta = Some(meta);
            s.percent = 100;
        }
        s.failed = result.err();
        s.finished = true;
    });
    *job.settled_at.lock().unwrap_or_else(|e| e.into_inner()) = Some(Instant::now());
}

#[cfg(test)]
pub(crate) fn forget_all() {
    jobs().lock().unwrap_or_else(|e| e.into_inner()).clear();
}
