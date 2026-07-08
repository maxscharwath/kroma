//! Outbound adapters: OS/process/network/filesystem integrations.
//!
//! These modules shell out to external tools (`ffprobe`, `ffmpeg`, `curl`),
//! touch the filesystem, advertise over mDNS, sample system metrics, and bridge
//! live events the edges where LUMA talks to the world outside the process.

pub mod probe;
pub mod ffmpeg_gate;
pub mod hls;
pub mod metadata;
// Extracted to workspace crates (heavy/optional dep graphs isolated so the rest
// of the server compiles without them). Aliased to keep `crate::infra::…` paths.
pub use luma_vector as embed;
pub use luma_whisper as whisper;
pub use luma_mdns as discovery;
pub mod llm;
pub mod image;
pub mod storyboard;
pub mod subtitles;
pub mod theme;
pub mod stream;
pub mod watch;
pub mod metrics;
pub mod events;
