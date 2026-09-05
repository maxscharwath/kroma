use std::path::{Path, PathBuf};

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

pub fn work_dir(data_dir: &Path, key: &str) -> PathBuf {
    trailers_dir(data_dir).join(format!(".{key}.work"))
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

/// What is already known about a key. Starts nothing, so a fiche can ask.
pub fn peek(data_dir: &Path, key: &str) -> Option<std::sync::Arc<Job>> {
    job::peek(data_dir, key)
}

pub fn is_complete(data_dir: &Path, key: &str) -> bool {
    job::is_complete(&cached_path(data_dir, key))
}

/// The finished file, or nothing. Serving is a read: it never starts a download,
/// so the public stream route cannot be used to make the server fetch anything.
pub fn open_stream(data_dir: &Path, key: &str) -> Option<PathBuf> {
    if !is_key_safe(key) {
        return None;
    }
    let path = cached_path(data_dir, key);
    job::is_complete(&path).then_some(path)
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
        super::job::forget_all();
        *HOOK.lock().unwrap_or_else(|e| e.into_inner()) = Some(hook);
    }

    pub fn clear() {
        super::job::forget_all();
        *HOOK.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn writes_a_clip(key: &str, out: &Path) -> Result<(), String> {
        let _ = key;
        std::fs::create_dir_all(out.parent().unwrap()).map_err(|e| e.to_string())?;
        std::fs::write(out, vec![0u8; 40 * 1024]).map_err(|e| e.to_string())
    }

    fn fails(_key: &str, _out: &Path) -> Result<(), String> {
        Err("yt-dlp: private video".into())
    }

    fn drain(job: &Job) {
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while !job.status().finished && std::time::Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    #[test]
    fn a_key_that_could_walk_out_of_the_cache_directory_is_refused() {
        assert!(!is_key_safe("../etc"));
        assert!(!is_key_safe(""));
        assert!(!is_key_safe("a/b"));
        assert!(is_key_safe("dQw4w9WgXcQ"));
    }

    #[test]
    fn a_download_lands_the_file_under_its_key() {
        let _lock = test_override::lock();
        let dir = tempfile::tempdir().unwrap();
        test_override::set(writes_a_clip);

        let job = begin(dir.path(), "dQw4w9WgXcQ").unwrap();
        drain(&job);

        test_override::clear();
        assert!(is_complete(dir.path(), "dQw4w9WgXcQ"));
        assert_eq!(job.status().failed, None);
        assert_eq!(open_stream(dir.path(), "dQw4w9WgXcQ"), Some(job.final_path.clone()));
    }

    #[test]
    fn a_second_begin_on_a_cached_key_starts_nothing() {
        let _lock = test_override::lock();
        let dir = tempfile::tempdir().unwrap();
        let path = cached_path(dir.path(), "dQw4w9WgXcQ");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, vec![0u8; 40 * 1024]).unwrap();
        test_override::set(fails);

        let job = begin(dir.path(), "dQw4w9WgXcQ").unwrap();

        test_override::clear();
        assert!(job.status().finished);
        assert_eq!(job.status().failed, None);
    }

    #[test]
    fn a_stream_of_a_key_that_was_never_prepared_starts_no_download() {
        let _lock = test_override::lock();
        let dir = tempfile::tempdir().unwrap();
        test_override::set(writes_a_clip);

        let served = open_stream(dir.path(), "neverAsked1");

        test_override::clear();
        assert_eq!(served, None);
        assert!(!trailers_dir(dir.path()).exists());
    }

    #[test]
    fn a_failed_download_is_reported_and_leaves_no_part_behind() {
        let _lock = test_override::lock();
        let dir = tempfile::tempdir().unwrap();
        test_override::set(fails);

        let job = begin(dir.path(), "privateVid1").unwrap();
        drain(&job);

        test_override::clear();
        assert!(job.status().failed.unwrap().contains("private video"));
        assert!(!part_path(dir.path(), "privateVid1").exists());
        assert!(!is_complete(dir.path(), "privateVid1"));
    }

    #[test]
    fn one_key_asked_for_twice_at_once_downloads_once() {
        let _lock = test_override::lock();
        let dir = tempfile::tempdir().unwrap();
        test_override::set(writes_a_clip);

        let first = begin(dir.path(), "sharedKey01").unwrap();
        let second = begin(dir.path(), "sharedKey01").unwrap();

        assert!(std::sync::Arc::ptr_eq(&first, &second));
        drain(&first);
        test_override::clear();
    }
}
