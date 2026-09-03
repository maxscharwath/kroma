use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

use super::pipeline;

const PLAYABLE_BYTES: u64 = 8 * 1024;
const MIN_COMPLETE: u64 = 32 * 1024;
const DOWNLOAD_SECS: u64 = 180;

pub struct Job {
    pub part: PathBuf,
    pub final_path: PathBuf,
    pub finished: Arc<AtomicBool>,
    pub failed: Arc<Mutex<Option<String>>>,
    playable: Arc<(Mutex<bool>, Condvar)>,
}

static JOBS: std::sync::OnceLock<Mutex<std::collections::HashMap<String, Arc<Job>>>> =
    std::sync::OnceLock::new();

fn jobs() -> &'static Mutex<std::collections::HashMap<String, Arc<Job>>> {
    JOBS.get_or_init(|| Mutex::new(std::collections::HashMap::new()))
}

pub fn file_len(path: &Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

pub fn is_complete(path: &Path) -> bool {
    path.exists() && file_len(path) >= MIN_COMPLETE
}

fn shorter_than_1080(path: &Path) -> bool {
    crate::infra::probe::probe_file(path, crate::infra::probe::ffprobe_available())
        .video
        .as_ref()
        .and_then(|v| v.height)
        .is_some_and(|h| h < 1080)
}

pub fn begin(data_dir: &Path, key: &str) -> Result<Arc<Job>, String> {
    if !super::cache::is_key_safe(key) {
        return Err("invalid trailer key".into());
    }
    let final_path = super::cache::cached_path(data_dir, key);
    if is_complete(&final_path) && !shorter_than_1080(&final_path) {
        return Ok(Arc::new(Job {
            part: final_path.clone(),
            final_path,
            finished: Arc::new(AtomicBool::new(true)),
            failed: Arc::new(Mutex::new(None)),
            playable: Arc::new((Mutex::new(true), Condvar::new())),
        }));
    }
    if is_complete(&final_path) {
        let _ = std::fs::remove_file(&final_path);
    }
    let mut map = jobs().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(job) = map.get(key) {
        return Ok(job.clone());
    }
    std::fs::create_dir_all(super::cache::trailers_dir(data_dir))
        .map_err(|e| format!("could not create trailers dir: {e}"))?;
    let part = super::cache::part_path(data_dir, key);
    let job = Arc::new(Job {
        part: part.clone(),
        final_path: final_path.clone(),
        finished: Arc::new(AtomicBool::new(false)),
        failed: Arc::new(Mutex::new(None)),
        playable: Arc::new((Mutex::new(false), Condvar::new())),
    });
    map.insert(key.to_string(), job.clone());
    drop(map);
    let worker = job.clone();
    let spawn_key = key.to_string();
    if let Err(e) = std::thread::Builder::new()
        .name(format!("trailer-{spawn_key}"))
        .spawn(move || run(worker, spawn_key))
    {
        jobs()
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(key);
        return Err(format!("could not start trailer download: {e}"));
    }
    Ok(job)
}

pub fn wait_playable(job: &Job, timeout: Duration) -> Result<(), String> {
    let (lock, cv) = &*job.playable;
    let mut ready = lock.lock().unwrap_or_else(|e| e.into_inner());
    let deadline = Instant::now() + timeout;
    while !*ready {
        if let Some(err) = job.failed.lock().ok().and_then(|g| g.clone()) {
            return Err(err);
        }
        if job.finished.load(Ordering::SeqCst) {
            break;
        }
        let now = Instant::now();
        if now >= deadline {
            return Err("trailer took too long to start".into());
        }
        let (next, wait) = cv
            .wait_timeout(ready, deadline - now)
            .unwrap_or_else(|e| e.into_inner());
        ready = next;
        if wait.timed_out() && !*ready {
            return Err("trailer took too long to start".into());
        }
    }
    if let Some(err) = job.failed.lock().ok().and_then(|g| g.clone()) {
        return Err(err);
    }
    if !is_complete(&job.final_path)
        && file_len(&job.part) < PLAYABLE_BYTES
        && file_len(&job.final_path) < PLAYABLE_BYTES
    {
        return Err("downloaded trailer was empty".into());
    }
    Ok(())
}

fn mark_playable(job: &Job) {
    let (lock, cv) = &*job.playable;
    let mut ready = lock.lock().unwrap_or_else(|e| e.into_inner());
    *ready = true;
    cv.notify_all();
}

fn finish(job: &Job, key: &str, result: Result<(), String>) {
    if let Err(err) = &result {
        if let Ok(mut slot) = job.failed.lock() {
            *slot = Some(err.clone());
        }
        let _ = std::fs::remove_file(&job.part);
    }
    job.finished.store(true, Ordering::SeqCst);
    mark_playable(job);
    let mut map = jobs().lock().unwrap_or_else(|e| e.into_inner());
    map.remove(key);
}

fn run(job: Arc<Job>, key: String) {
    let watcher = job.clone();
    std::thread::spawn(move || {
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(DOWNLOAD_SECS) {
            if watcher.finished.load(Ordering::SeqCst) {
                return;
            }
            if file_len(&watcher.part) >= PLAYABLE_BYTES || file_len(&watcher.final_path) >= PLAYABLE_BYTES
            {
                mark_playable(&watcher);
                return;
            }
            std::thread::sleep(Duration::from_millis(40));
        }
    });
    let result = pipeline::download(&key, &job.part).and_then(|()| {
        if file_len(&job.part) < MIN_COMPLETE {
            let _ = std::fs::remove_file(&job.part);
            return Err("downloaded trailer was empty".into());
        }
        std::fs::rename(&job.part, &job.final_path).map_err(|e| {
            let _ = std::fs::remove_file(&job.part);
            format!("could not move trailer into place: {e}")
        })
    });
    finish(&job, &key, result);
}
