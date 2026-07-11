//! The acquisition background jobs (search / import / match), moved out of the
//! core luma-engine job roster so the core names no module crate. Each handler
//! file owns its `pub const SPEC` + `pub fn run`; the crate root gathers the
//! three SPECs into [`crate::JOBS`], which the binary hands to `AppState::new`
//! for registration.

pub mod import;
pub mod match_;
pub mod search;

use luma_engine::services::jobs::JobContext;
use luma_module_host::HostCtx;

/// The acquisition jobs belong to the Downloads module: they grab + import
/// torrents. When that module is disabled the whole system is torn down, so
/// these jobs no-op (a disabled module does no background work). Returns true
/// (and logs) when the caller should skip. Ported from the former core
/// `builtins::downloads_disabled`, now resolving the enabled-state through the
/// `HostCtx` seam instead of the core's `modules::module_enabled`.
fn downloads_disabled(ctx: &JobContext) -> bool {
    if ctx.state.module_enabled(crate::MODULE_ID) {
        return false;
    }
    ctx.info("Downloads module disabled; skipping.");
    true
}
