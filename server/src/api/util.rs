//! Shared HTTP-handler helpers. The `spawn_blocking` DB combinators live on the
//! module host seam; re-exported here so existing call sites are unchanged.

use std::net::SocketAddr;

use axum::http::HeaderMap;
use serde::Deserialize;

pub(crate) use kroma_module_host::{blocking, query};

/// `?secret=…`: how a device already in the world identifies its own pending
/// Quick Connect request. Newer callers send `X-Kroma-Pairing-Secret` instead,
/// and the handoff poll takes it in a POST body: a URL is logged everywhere.
///
/// Optional, because a caller that sends the header sends no query at all, and a
/// required field would reject it before the handler ever looked.
#[derive(Debug, Default, Deserialize)]
pub struct SecretQuery {
    #[serde(default)]
    pub secret: Option<String>,
}

/// Whether this peer's forwarding headers may be believed: loopback always (a
/// proxy on the same host), plus anything the operator named in
/// `KROMA_TRUSTED_PROXIES`.
///
/// Trusting the wrong peer is the whole danger, which is why the list is empty
/// by default and why it should never be widened to a range clients live in:
/// whoever matches it can claim to be anyone.
fn trusted_peer(addr: &SocketAddr, trusted: &[String]) -> bool {
    let ip = addr.ip();
    ip.is_loopback()
        || trusted.iter().any(|entry| {
            let entry = entry.trim();
            entry.parse::<std::net::IpAddr>().is_ok_and(|named| named == ip)
                || crate::services::playback::cidr_contains(entry, &ip)
        })
}

/// Best client IP for playback accounting, the login brute-force guard, and the
/// network rule nearby pairing is built on.
///
/// `CF-Connecting-IP` / `X-Forwarded-For` are client-settable, so they are read
/// only from a peer worth believing (see [`trusted_peer`]).
///
/// And then only the RIGHTMOST `X-Forwarded-For` entry, which is the one that
/// proxy observed. The convention every common proxy follows (nginx's
/// `$proxy_add_x_forwarded_for`, Caddy, Traefik) is to APPEND the peer it saw to
/// whatever the client sent, so the header reads `client-supplied…, real-peer`
/// and the leftmost entry is under the caller's control. Taking it would let
/// anyone on the internet claim to be on your subnet.
///
/// A proxy the server has NOT been told about is the other failure, and a quiet
/// one: its header is discarded, every request arrives wearing the proxy's own
/// address, and the server can no longer tell two clients apart at all.
pub(crate) fn client_ip(headers: &HeaderMap, addr: &SocketAddr, trusted: &[String]) -> String {
    if trusted_peer(addr, trusted) {
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
        ip_for_trusting(peer, headers, &[])
    }

    fn ip_for_trusting(peer: [u8; 4], headers: &[(&str, &str)], trusted: &[String]) -> String {
        let mut map = HeaderMap::new();
        for (k, v) in headers {
            map.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        client_ip(&map, &SocketAddr::from((peer, 40000)), trusted)
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
    fn a_proxy_that_is_not_on_loopback_is_believed_only_once_it_is_named() {
        // The shape that made this setting necessary: the proxy runs in another
        // container, so its peer address is a bridge address and nothing else.
        // Unnamed, its header is discarded and EVERY client arrives wearing the
        // proxy's address, which is how one network came to hold everyone.
        const PROXY: [u8; 4] = [172, 18, 0, 2];
        let forwarded = [("x-forwarded-for", "192.168.1.20, 172.18.0.2")];

        assert_eq!(ip_for(PROXY, &forwarded), "172.18.0.2", "unnamed proxies are not believed");
        assert_eq!(
            ip_for_trusting(PROXY, &forwarded, &["172.18.0.0/16".to_string()]),
            "172.18.0.2"
        );
    }

    #[test]
    fn a_named_proxy_is_believed_by_address_or_by_range() {
        const PROXY: [u8; 4] = [10, 8, 0, 4];
        let forwarded = [("x-forwarded-for", "203.0.113.7")];

        assert_eq!(ip_for_trusting(PROXY, &forwarded, &["10.8.0.4".to_string()]), "203.0.113.7");
        assert_eq!(ip_for_trusting(PROXY, &forwarded, &["10.8.0.0/16".to_string()]), "203.0.113.7");
        assert_eq!(ip_for_trusting(PROXY, &forwarded, &["10.8.".to_string()]), "203.0.113.7");
        // Some other proxy's address buys nothing.
        assert_eq!(ip_for_trusting(PROXY, &forwarded, &["10.9.0.4".to_string()]), "10.8.0.4");
        assert_eq!(ip_for_trusting(PROXY, &forwarded, &["not-an-address".to_string()]), "10.8.0.4");
    }

    #[test]
    fn loopback_is_believed_without_being_named() {
        // A proxy on the same host is the ordinary case, and naming it would be
        // a step every single-box install had to take for nothing.
        assert_eq!(ip_for(LOOPBACK, &[("x-forwarded-for", "203.0.113.7")]), "203.0.113.7");
    }

    #[test]
    fn an_empty_or_absent_header_falls_back_to_the_peer() {
        assert_eq!(ip_for(LOOPBACK, &[]), "127.0.0.1");
        assert_eq!(ip_for(LOOPBACK, &[("x-forwarded-for", "  ")]), "127.0.0.1");
        assert_eq!(ip_for(LOOPBACK, &[("cf-connecting-ip", "")]), "127.0.0.1");
    }
}
