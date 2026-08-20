//! Catalog writes: metadata attachment, ffprobe results and the scan diff-sync.
//!
//! Three writers, re-exported flat here so the public `db::<item>` paths resolve
//! unchanged: [`metadata`] attaches what enrichment resolved, [`probe`] records
//! what ffprobe found, and [`sync`] with [`scanned_files`] diff-sync what a
//! library scan saw against what the database already holds.

use std::collections::HashMap;

use rusqlite::OptionalExtension;

use super::*;
use kroma_domain::{CastMember, Library, LibraryKind, Metadata, Show};

mod metadata;
mod probe;
mod probe_result;
mod scanned_files;
mod sync;

#[cfg(test)]
mod test_support;

pub use metadata::*;
pub use probe::*;
pub use probe_result::*;
pub use sync::*;
