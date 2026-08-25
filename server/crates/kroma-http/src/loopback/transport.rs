//! What a transport on the internal seam has to be able to do.
//!
//! One exchange, addressed by a URL, answered with a [`Response`]. Everything
//! the seam carries -- a point call, a host callback, an event delivery -- is
//! that shape, so a new way for two KROMA processes to talk is a new
//! implementation of this trait and nothing else.

use std::time::Duration;

use anyhow::Result;

use crate::response::Response;

/// The verb of an exchange. The seam has no use for the rest of them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Method {
    Get,
    Post,
}

impl Method {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Get => "GET",
            Self::Post => "POST",
        }
    }
}

/// One prepared exchange, borrowed for the length of the call.
#[derive(Debug)]
pub struct Request<'a> {
    pub method: Method,
    pub url: &'a str,
    pub headers: &'a [(String, String)],
    /// `(content-type, bytes)`, absent on a GET.
    pub body: Option<(&'a str, &'a [u8])>,
    /// Budget for the whole exchange.
    pub timeout: Duration,
}

/// A way for one KROMA process to reach another.
///
/// Implementations are chosen by the URL they are handed, so adding one means
/// writing it, claiming its URLs in [`Transport::accepts`], and registering it
/// with [`super::register`] -- no call site changes, because every caller holds a
/// [`super::Loopback`] rather than a transport.
///
/// [`Transport::send`] blocks the calling thread. An implementation built on
/// async internals owns that bridge itself.
pub trait Transport: Send + Sync + 'static {
    /// Short identifier, for the error a URL nothing claims produces.
    fn name(&self) -> &'static str;

    /// Whether this transport is the one that reaches `url`.
    fn accepts(&self, url: &str) -> bool;

    fn send(&self, request: &Request<'_>) -> Result<Response>;
}
