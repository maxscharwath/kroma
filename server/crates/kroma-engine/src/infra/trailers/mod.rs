//! Local cache of movie trailers. yt-dlp fetches and merges the clip on first
//! play; the finished H.264/AAC file is then Range-served like any other file.

mod cache;
mod job;
mod normalise;
mod pick;
mod pipeline;
mod source;

pub use cache::{begin, cached_path, is_complete, is_key_safe, open_stream, peek, trailers_dir};
pub use job::{Job, Status};
pub use pick::pick;
pub use source::ClipMeta;
