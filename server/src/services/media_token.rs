//! Short-lived, media-scoped access tokens (the `?t=` on image / stream /
//! subtitle / WebSocket URLs, which can't carry an `Authorization` header).
//!
//! A token is a compact, stateless, uid-bound HMAC bearer: the auth gate
//! ([`crate::api::authgate`]) verifies it with no DB lookup and recovers the
//! user id, so a poster grid's hundreds of image requests cost one HMAC each.
//! It reuses the password module's HMAC / constant-time / randomness primitives
//! ([`super::auth`]); this module owns the token layout, the base64url codec and
//! the signing secret.

use super::auth::{ct_eq, hmac_sha256, random_bytes};

/// Media-token lifetime. One token for every media URL (images, streams,
/// subtitles, the events WebSocket). It has to outlast the longest single
/// playback: the URL token is fixed once a `<video>`/HLS/native player starts and
/// none of those can swap it mid-stream, so a shorter TTL would 401 the Range /
/// segment requests partway through a film. 6h covers any single title (it also
/// refreshes automatically while browsing) while staying a tiny fraction of the
/// 90-day session token. Media-scoped + uid-bound (the gate only accepts it on
/// media routes, never JSON/admin), so exposing it in an `<img>` URL can't touch
/// the account.
pub const MEDIA_TOKEN_TTL_SECS: i64 = 6 * 3600;

/// Media-token truncated-HMAC length (bytes). 48 bits: forging one means ~2^48
/// online guesses against a chosen `(exp, uid)` to unlock media any signed-in
/// user can already read, and the token expires within hours.
const MEDIA_MAC_LEN: usize = 6;

/// Raw user-id length (bytes). Ids are `short_hash` = 16 hex chars = 8 bytes.
const MEDIA_UID_LEN: usize = 8;

/// Expiry field width (bytes): a big-endian `u32` of unix seconds (second
/// precision, no wraparound until 2106). The expiry is inside the signed payload,
/// so it cannot be tampered with.
const MEDIA_EXP_LEN: usize = 4;

/// Total decoded token length. 18 bytes → a clean 24-char base64url string.
const MEDIA_TOKEN_LEN: usize = MEDIA_EXP_LEN + MEDIA_UID_LEN + MEDIA_MAC_LEN;

fn now_unix() -> i64 {
    time::OffsetDateTime::now_utc().unix_timestamp()
}

/// Pack a 16-hex-char user id into [`MEDIA_UID_LEN`] bytes (defensively zero-padded
/// / truncated; real ids are always exactly 16 hex chars).
fn uid_to_bytes(uid: &str) -> [u8; MEDIA_UID_LEN] {
    let mut out = [0u8; MEDIA_UID_LEN];
    if let Ok(b) = hex::decode(uid) {
        let n = b.len().min(MEDIA_UID_LEN);
        out[..n].copy_from_slice(&b[..n]);
    }
    out
}

/// Mint a short-lived, media-scoped token BOUND to `uid`, HMAC-signed with
/// `secret`. Layout: `base64url(exp_u32_secs || uid[8] || hmac(exp||uid)[..6])`
/// an 18-byte, 24-char opaque token. Fully stateless: [`verify_media_token`]
/// recovers the uid and checks the signature with no server-side store, so a media
/// request can be attributed to a user (access logs / per-user gating) while the
/// token stays small enough to ride in every image/segment URL. Verifying the
/// hundreds of image requests a poster grid fires costs one HMAC each, no DB hit.
pub fn mint_media_token(secret: &[u8], uid: &str, ttl_secs: i64) -> String {
    let exp = (now_unix() + ttl_secs).clamp(0, u32::MAX as i64) as u32;
    let mut buf = Vec::with_capacity(MEDIA_TOKEN_LEN);
    buf.extend_from_slice(&exp.to_be_bytes());
    buf.extend_from_slice(&uid_to_bytes(uid));
    let mac = hmac_sha256(secret, &buf);
    buf.extend_from_slice(&mac[..MEDIA_MAC_LEN]);
    base64url_encode(&buf)
}

/// Verify a media token against `secret`, returning the bound user id (16-hex)
/// when the signature matches and it has not expired. Constant-time compare.
pub fn verify_media_token(secret: &[u8], token: &str) -> Option<String> {
    let raw = base64url_decode(token)?;
    if raw.len() != MEDIA_TOKEN_LEN {
        return None;
    }
    let exp = u32::from_be_bytes([raw[0], raw[1], raw[2], raw[3]]) as i64;
    if exp <= now_unix() {
        return None;
    }
    let split = MEDIA_EXP_LEN + MEDIA_UID_LEN;
    let mac = hmac_sha256(secret, &raw[..split]);
    if !ct_eq(&raw[split..], &mac[..MEDIA_MAC_LEN]) {
        return None;
    }
    Some(hex::encode(&raw[MEDIA_EXP_LEN..split]))
}

/// Load (or create on first run) the 32-byte secret that signs media tokens,
/// stored `0600` at `<data>/.media_secret`. Persisting it means a client holding
/// a still-valid token keeps loading images across a server restart, rather than
/// every media URL 401-ing until it re-mints.
pub fn load_or_create_media_secret(data_dir: &std::path::Path) -> Vec<u8> {
    let path = data_dir.join(".media_secret");
    if let Ok(text) = std::fs::read_to_string(&path) {
        if let Ok(bytes) = hex::decode(text.trim()) {
            if bytes.len() == 32 {
                return bytes;
            }
        }
    }
    let secret = random_bytes(32);
    // Best-effort persist: on a write failure we still return a usable in-memory
    // secret (tokens simply won't survive this process).
    if std::fs::write(&path, hex::encode(&secret)).is_ok() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }
    }
    secret
}

// ----- base64url (no padding) -------------------------------------------------
// Tiny, dependency-free codec (the project hand-rolls its crypto). Used only for
// the compact media token; the token length is always a multiple of 3 bytes, so
// encode/decode stay on 4-char boundaries.

const B64URL: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

fn base64url_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);
        out.push(B64URL[((n >> 18) & 63) as usize] as char);
        out.push(B64URL[((n >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            out.push(B64URL[((n >> 6) & 63) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(B64URL[(n & 63) as usize] as char);
        }
    }
    out
}

fn base64url_val(c: u8) -> Option<u8> {
    match c {
        b'A'..=b'Z' => Some(c - b'A'),
        b'a'..=b'z' => Some(c - b'a' + 26),
        b'0'..=b'9' => Some(c - b'0' + 52),
        b'-' => Some(62),
        b'_' => Some(63),
        _ => None,
    }
}

fn base64url_decode(s: &str) -> Option<Vec<u8>> {
    if s.len() % 4 != 0 {
        return None;
    }
    let mut out = Vec::with_capacity(s.len() / 4 * 3);
    for chunk in s.as_bytes().chunks(4) {
        let mut n = 0u32;
        for &c in chunk {
            n = (n << 6) | base64url_val(c)? as u32;
        }
        out.push((n >> 16) as u8);
        out.push((n >> 8) as u8);
        out.push(n as u8);
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_token_round_trip_and_tamper() {
        let secret = b"0123456789abcdef0123456789abcdef";
        let uid = "5ac1591fe8d6a8d0"; // a real short_hash id (16 hex chars)
        let tok = mint_media_token(secret, uid, 3600);
        assert_eq!(tok.len(), 24, "uid-bound token is 24 chars");
        // Verifies AND recovers the bound user id.
        assert_eq!(verify_media_token(secret, &tok).as_deref(), Some(uid));
        // Wrong secret rejects.
        assert!(verify_media_token(b"different-secret-bytes-............", &tok).is_none());
        // A flipped character rejects (constant-time compare still fails).
        let mut bad = tok.clone();
        let last = bad.pop().unwrap();
        bad.push(if last == 'A' { 'B' } else { 'A' });
        assert!(verify_media_token(secret, &bad).is_none());
        // Already-expired token rejects.
        assert!(verify_media_token(secret, &mint_media_token(secret, uid, -3600)).is_none());
        // Garbage shapes reject rather than panic.
        assert!(verify_media_token(secret, "nonsense!").is_none());
        assert!(verify_media_token(secret, "").is_none());
        assert!(verify_media_token(secret, "a.b.c").is_none());
    }

    #[test]
    fn base64url_round_trips() {
        for data in [&b"abc"[..], &b"123456789"[..], &[0u8, 255, 128, 1, 2][..]] {
            // Only exercise multiple-of-3 inputs (what the token uses) for exact round-trip.
            if data.len() % 3 == 0 {
                assert_eq!(base64url_decode(&base64url_encode(data)).as_deref(), Some(data));
            }
        }
        assert!(base64url_decode("bad len").is_none());
        assert!(base64url_decode("****").is_none());
    }
}
