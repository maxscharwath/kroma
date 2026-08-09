//! Shared HTTP-handler helpers. The `spawn_blocking` DB combinators live on the
//! module host seam; re-exported here so existing call sites are unchanged.

use std::net::SocketAddr;

use axum::http::HeaderMap;
use serde::Deserialize;

pub(crate) use kroma_module_host::{blocking, query};

/// `?secret=…`: how a device waiting to be paired identifies its own pending
/// request, on both `/auth/quickconnect/poll` and `/handoff/poll`.
#[derive(Debug, Deserialize)]
pub struct SecretQuery {
    pub secret: String,
}

/// Best client IP for playback accounting, the login brute-force guard, and the
/// network rule nearby pairing is built on.
///
/// `CF-Connecting-IP` / `X-Forwarded-For` are client-settable, so they are read
/// only when the direct peer is loopback, which is the local-reverse-proxy case.
///
/// And then only the RIGHTMOST `X-Forwarded-For` entry, which is the one that
/// proxy observed. The convention every common proxy follows (nginx's
/// `$proxy_add_x_forwarded_for`, Caddy, Traefik) is to APPEND the peer it saw to
/// whatever the client sent, so the header reads `client-supplied…, real-peer`
/// and the leftmost entry is under the caller's control. Taking it would let
/// anyone on the internet claim to be on your subnet.
pub(crate) fn client_ip(headers: &HeaderMap, addr: &SocketAddr) -> String {
    if addr.ip().is_loopback() {
        if let Some(cf) = headers.get("cf-connecting-ip").and_then(|v| v.to_str().ok()) {
            let cf = cf.trim();
            if !cf.is_empty() {
                return cf.to_string();
            }
        }
        if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
            if let Some(nearest) = xff.rsplit(',').next() {
                let nearest = nearest.trim();
                if !nearest.is_empty() {
                    return nearest.to_string();
                }
            }
        }
    }
    addr.ip().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn ip_for(peer: [u8; 4], headers: &[(&str, &str)]) -> String {
        let mut map = HeaderMap::new();
        for (k, v) in headers {
            map.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        client_ip(&map, &SocketAddr::from((peer, 40000)))
    }

    const LOOPBACK: [u8; 4] = [127, 0, 0, 1];
    const DIRECT: [u8; 4] = [192, 168, 1, 9];

    #[test]
    fn a_forwarded_header_is_read_only_from_a_loopback_peer() {
        assert_eq!(ip_for(DIRECT, &[("x-forwarded-for", "203.0.113.7")]), "192.168.1.9");
        assert_eq!(ip_for(DIRECT, &[("cf-connecting-ip", "203.0.113.7")]), "192.168.1.9");
    }

    #[test]
    fn the_forwarded_entry_taken_is_the_one_the_proxy_added() {
        // The shape nginx produces: what the caller sent, then the peer it saw.
        // Believing the caller's half is how a stranger claims to be on your
        // subnet, so the rightmost entry is the only one worth anything.
        assert_eq!(
            ip_for(LOOPBACK, &[("x-forwarded-for", "192.168.1.20, 203.0.113.7")]),
            "203.0.113.7"
        );
        assert_eq!(ip_for(LOOPBACK, &[("x-forwarded-for", "203.0.113.7")]), "203.0.113.7");
        // Several proxies deep, it is still the nearest one that saw a peer.
        assert_eq!(
            ip_for(LOOPBACK, &[("x-forwarded-for", "10.0.0.1, 172.16.0.1, 203.0.113.7")]),
            "203.0.113.7"
        );
    }

    #[test]
    fn cloudflare_wins_because_it_sets_its_header_itself() {
        assert_eq!(
            ip_for(
                LOOPBACK,
                &[("cf-connecting-ip", "198.51.100.4"), ("x-forwarded-for", "1.2.3.4, 5.6.7.8")]
            ),
            "198.51.100.4"
        );
    }

    #[test]
    fn an_empty_or_absent_header_falls_back_to_the_peer() {
        assert_eq!(ip_for(LOOPBACK, &[]), "127.0.0.1");
        assert_eq!(ip_for(LOOPBACK, &[("x-forwarded-for", "  ")]), "127.0.0.1");
        assert_eq!(ip_for(LOOPBACK, &[("cf-connecting-ip", "")]), "127.0.0.1");
    }
}
