//! Low-level, dependency-light primitives shared across the server's layers:
//! monotonic-ish wall-clock timestamps, stable short hashes, and random tokens.
//!
//! These are pure computations (plus one `/dev/urandom` read) that several layers
//! need: the persistence layer stamps `created_at`, adapters key caches by
//! content hash, services mint session tokens. They live here, below `kroma-db`,
//! so the lower layers don't have to reach up into `services` for a helper.
//! The former `services::{jobs::now_ms, scan::{now_iso8601, short_hash},
//! auth::random_*}` re-export from here for backwards compatibility.

use sha2::{Digest, Sha256};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

/// Current time as epoch milliseconds (UTC instant).
pub fn now_ms() -> i64 {
    (OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000) as i64
}

/// Current time as an RFC3339 / ISO8601 string (UTC).
pub fn now_iso8601() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

/// `hex(sha256(input))[..16]` stable, short, collision-resistant enough.
pub fn short_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())[..16].to_string()
}

/// `n` cryptographically-secure random bytes, read from the OS CSPRNG
/// (`/dev/urandom`, falling back to `/dev/random`).
///
/// Every session/access/invite token, password salt and Quick Connect code is
/// derived from this, so there is deliberately **no** algorithmic fallback: if
/// the kernel RNG cannot be read we panic rather than mint predictable secrets.
/// A clock-seeded stand-in (the previous behaviour) would let an attacker who
/// can estimate when a token was generated brute-force the seed. On the only
/// platforms the server targets (Linux NAS / macOS) the device is always
/// present, so this never triggers in practice.
pub fn random_bytes(n: usize) -> Vec<u8> {
    use std::io::Read;
    let mut buf = vec![0u8; n];
    for path in ["/dev/urandom", "/dev/random"] {
        if let Ok(mut f) = std::fs::File::open(path) {
            if f.read_exact(&mut buf).is_ok() {
                return buf;
            }
        }
    }
    panic!("kroma-primitives: OS CSPRNG unavailable; refusing to generate insecure randomness");
}

/// A fresh opaque session token: 32 random bytes, hex-encoded (64 chars).
pub fn random_token() -> String {
    hex::encode(random_bytes(32))
}

/// A random `u32` (used to pick Quick Connect numeric codes).
pub fn random_u32() -> u32 {
    let b = random_bytes(4);
    u32::from_le_bytes([b[0], b[1], b[2], b[3]])
}
