//! Shared HTTP-handler helpers. The `spawn_blocking` DB combinators now live on
//! the module host seam (so relocated module crates share them); re-exported here
//! so `crate::api::util::{blocking, query}` call sites are unchanged.

use std::net::SocketAddr;

use axum::http::HeaderMap;

pub(crate) use kroma_module_host::{blocking, query};

/// Best client IP for an incoming request. Shared by playback session accounting
/// and the login brute-force guard.
///
/// `CF-Connecting-IP` / `X-Forwarded-For` are client-settable headers: they can
/// only be trusted when a trusted reverse proxy sets them, never when the
/// request comes straight from the client. If the guard trusted them
/// unconditionally an attacker could rotate a fake IP on every login attempt and
/// the per-IP lockout would never trip (unlimited online password guessing).
///
/// So we only honour the forwarded headers when the direct socket peer is
/// loopback, which is exactly where a same-host front end runs: the Cloudflare
/// tunnel (`cloudflared`) and the Synology reverse proxy both connect over
/// localhost, and Cloudflare overwrites `CF-Connecting-IP` at its edge. A direct
/// LAN/port-forward client (a non-loopback peer) can't spoof its way past the
/// guard; its real socket address is used. A reverse proxy on a *different* host
/// falls back to keying on the proxy's address (fails safe: over-, not
/// under-restrictive).
pub(crate) fn client_ip(headers: &HeaderMap, addr: &SocketAddr) -> String {
    if addr.ip().is_loopback() {
        if let Some(cf) = headers.get("cf-connecting-ip").and_then(|v| v.to_str().ok()) {
            let cf = cf.trim();
            if !cf.is_empty() {
                return cf.to_string();
            }
        }
        if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
            if let Some(first) = xff.split(',').next() {
                let first = first.trim();
                if !first.is_empty() {
                    return first.to_string();
                }
            }
        }
    }
    addr.ip().to_string()
}
