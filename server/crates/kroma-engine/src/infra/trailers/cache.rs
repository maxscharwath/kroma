use std::path::{Path, PathBuf};
use std::time::Duration;

#[cfg(test)]
use std::sync::atomic::Ordering;

use super::job::{self, Job};

pub fn trailers_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("trailers")
}

pub fn cached_path(data_dir: &Path, key: &str) -> PathBuf {
    trailers_dir(data_dir).join(format!("{key}.mp4"))
}

pub fn part_path(data_dir: &Path, key: &str) -> PathBuf {
    trailers_dir(data_dir).join(format!("{key}.part.mp4"))
}

pub fn is_key_safe(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 32
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
}

pub fn begin(data_dir: &Path, key: &str) -> Result<std::sync::Arc<Job>, String> {
    job::begin(data_dir, key)
}

pub fn is_complete(data_dir: &Path, key: &str) -> bool {
    job::is_complete(&cached_path(data_dir, key))
}

#[cfg(test)]
pub fn cache(data_dir: &Path, key: &str) -> Result<PathBuf, String> {
    let job = begin(data_dir, key)?;
    job::wait_playable(&job, Duration::from_secs(180))?;
    while !job.finished.load(Ordering::SeqCst) {
        if let Some(err) = job.failed.lock().ok().and_then(|g| g.clone()) {
            return Err(err);
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    if let Some(err) = job.failed.lock().ok().and_then(|g| g.clone()) {
        return Err(err);
    }
    if !job::is_complete(&job.final_path) {
        return Err("downloaded trailer was empty".into());
    }
    Ok(job.final_path.clone())
}

pub enum TrailerBytes {
    Complete(PathBuf),
    Growing {
        path: PathBuf,
        finished: std::sync::Arc<std::sync::atomic::AtomicBool>,
        failed: std::sync::Arc<std::sync::Mutex<Option<String>>>,
    },
}

pub fn open_stream(data_dir: &Path, key: &str) -> Result<TrailerBytes, String> {
    let job = begin(data_dir, key)?;
    job::wait_playable(&job, Duration::from_secs(45))?;
    if job::is_complete(&job.final_path) {
        return Ok(TrailerBytes::Complete(job.final_path.clone()));
    }
    let path = if job.part.exists() {
        job.part.clone()
    } else {
        job.final_path.clone()
    };
    Ok(TrailerBytes::Growing {
        path,
        finished: job.finished.clone(),
        failed: job.failed.clone(),
    })
}

#[cfg(test)]
pub(crate) mod test_override {
    use super::*;
    use std::sync::{Mutex, MutexGuard};

    type DownloadHook = fn(&str, &Path) -> Result<(), String>;

    static LOCK: Mutex<()> = Mutex::new(());
    static HOOK: Mutex<Option<DownloadHook>> = Mutex::new(None);

    pub fn lock() -> MutexGuard<'static, ()> {
        LOCK.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn get() -> Option<DownloadHook> {
        *HOOK.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn set(hook: DownloadHook) {
        *HOOK.lock().unwrap_or_else(|e| e.into_inner()) = Some(hook);
    }

    pub fn clear() {
        *HOOK.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_min(key: &str, out: &Path) -> Result<(), String> {
        let _ = key;
        std::fs::write(out, vec![0u8; 40 * 1024]).map_err(|e| e.to_string())
    }

    #[test]
    fn a_second_prepare_is_a_no_op_when_the_file_is_already_there() {
        let dir = tempfile::tempdir().unwrap();
        let path = cached_path(dir.path(), "dQw4w9WgXcQ");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, vec![0u8; 40 * 1024]).unwrap();

        let first = cache(dir.path(), "dQw4w9WgXcQ").unwrap();
        let second = cache(dir.path(), "dQw4w9WgXcQ").unwrap();

        assert_eq!(first, second);
        assert_eq!(std::fs::read(&first).unwrap().len(), 40 * 1024);
    }

    #[test]
    fn a_download_hook_lands_the_file_and_renames_it() {
        let _lock = test_override::lock();
        let dir = tempfile::tempdir().unwrap();
        test_override::set(write_min);

        let path = cache(dir.path(), "dQw4w9WgXcQ").unwrap();

        test_override::clear();
        assert_eq!(path.file_name().unwrap(), "dQw4w9WgXcQ.mp4");
        assert_eq!(std::fs::read(&path).unwrap().len(), 40 * 1024);
    }

    #[test]
    fn a_junk_key_is_refused_before_any_download() {
        let dir = tempfile::tempdir().unwrap();

        let err = cache(dir.path(), "../etc").unwrap_err();

        assert!(err.contains("invalid"));
    }

    fn writes_a_prefix_then_the_rest(key: &str, out: &Path) -> Result<(), String> {
        let _ = key;
        std::fs::write(out, vec![0u8; 10 * 1024]).map_err(|e| e.to_string())?;
        std::thread::sleep(Duration::from_millis(400));
        std::fs::write(out, vec![0u8; 40 * 1024]).map_err(|e| e.to_string())
    }

    fn drain(job: &Job) {
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while !job.finished.load(Ordering::SeqCst) && std::time::Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    #[test]
    fn begin_returns_before_the_copy_is_finished() {
        let _lock = test_override::lock();
        let dir = tempfile::tempdir().unwrap();
        test_override::set(writes_a_prefix_then_the_rest);

        let start = std::time::Instant::now();
        let job = begin(dir.path(), "slowStart1").unwrap();
        let returned = start.elapsed();

        assert!(
            returned < Duration::from_millis(150),
            "begin waited {returned:?}"
        );
        assert!(!job.finished.load(Ordering::SeqCst));
        drain(&job);
        test_override::clear();
    }

    #[test]
    fn a_stream_opens_on_a_playable_prefix_before_the_copy_is_done() {
        let _lock = test_override::lock();
        let dir = tempfile::tempdir().unwrap();
        test_override::set(writes_a_prefix_then_the_rest);

        let bytes = open_stream(dir.path(), "slowStart2").unwrap();
        let TrailerBytes::Growing { finished, .. } = &bytes else {
            panic!("expected a growing stream, got a complete file");
        };

        assert!(!finished.load(Ordering::SeqCst));
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while !finished.load(Ordering::SeqCst) && std::time::Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(20));
        }
        test_override::clear();
        assert!(is_complete(dir.path(), "slowStart2"));
    }
}
