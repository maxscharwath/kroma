//! `cache.cleanup` — wipe the on-demand HLS transcode cache (disposable;
//! regenerated on playback). Leaves the localized poster/backdrop cache alone
//! (expensive to refetch).

use std::path::Path;

use super::prelude::*;

pub(super) fn run(ctx: &JobContext) -> Result<()> {
    let transcode = ctx.state.config.data_dir.join("transcode");
    ctx.info(format!("clearing transcode cache at {}", transcode.display()));
    let before = dir_size(&transcode);

    let entries: Vec<_> = std::fs::read_dir(&transcode)
        .map(|rd| rd.flatten().collect())
        .unwrap_or_default();
    let total = entries.len();
    for (i, entry) in entries.iter().enumerate() {
        if ctx.cancelled() {
            ctx.warn("cancellation requested — stopping cache cleanup");
            break;
        }
        let p = entry.path();
        if p.is_dir() {
            let _ = std::fs::remove_dir_all(&p);
        } else {
            let _ = std::fs::remove_file(&p);
        }
        ctx.progress(i + 1, total);
    }

    let freed = before.saturating_sub(dir_size(&transcode));
    ctx.info(format!("freed {} across {total} cache entries", human_bytes(freed)));
    Ok(())
}

/// Recursive byte size of a directory tree (0 if missing).
fn dir_size(path: &Path) -> u64 {
    walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(std::result::Result::ok)
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

/// Compact human byte size for log lines (e.g. `1.4 GB`).
fn human_bytes(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit = 0;
    while size >= 1024.0 && unit < UNITS.len() - 1 {
        size /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{bytes} B")
    } else {
        format!("{size:.1} {}", UNITS[unit])
    }
}
