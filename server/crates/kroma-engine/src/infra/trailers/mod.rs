//! Local cache of movie trailers. Bytes are fetched on first play and served
//! while the copy is still growing, then Range-served once it is complete.

mod cache;
mod growing;
mod job;
mod pick;
mod pipeline;
mod source;

pub use cache::{
    begin, cached_path, is_complete, is_key_safe, open_stream, trailers_dir, TrailerBytes,
};
pub use growing::stream_growing;
pub use pick::pick;
pub use pipeline::duration_ms;
