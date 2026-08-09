//! Nearby handoff: a signed-out TV publishes a beacon, and a phone already
//! signed in picks that TV out of a list and hands its account over. Nothing to
//! scan, nothing to type.
//!
//! What keeps it safe is reach, not secrecy. A beacon is only ever listed to a
//! caller whose own address sits on the same subnet as the TV that published it,
//! so "the TVs I can see" means "the TVs on this network" and never "every TV
//! this server knows". The handle a phone grants against is server-minted and
//! unguessable, the poll secret never leaves the TV, and the grant mints an
//! ordinary session that shows up in the account's device list like any other.
//!
//! A beacon also carries a short check string the TV prints on its own screen.
//! Nobody is asked to type it. It is there so that a person facing two TVs, or
//! facing a device that named itself after theirs, can tell which row is which.

use std::net::IpAddr;
use std::sync::Arc;

use super::grants::{Granted, Grants, Orphaned, PollState};
use crate::model::User;
use crate::services::auth::random_bytes;
use kroma_primitives::clean_label;

/// The shape a TV's self-declared device id must have. Checked at the HTTP
/// boundary, like the cast roster's receiver ids: same rule, same reason.
pub use kroma_primitives::valid_device_id;

/// How long a beacon lives unpolled. A TV that was unplugged should leave the
/// phone's list about as fast as a person would expect it to.
pub const BEACON_TTL_SECS: i64 = 60;
/// How often the TV is told to poll. It has to poll anyway, since that is how
/// it learns it was granted, so the poll doubles as the beacon's liveness signal
/// and there is no second loop to fall out of step with it. Well inside the TTL.
pub const POLL_SECS: i64 = 3;

// Announcing is unauthenticated by design (the TV has no account yet), so this
// bounds the store. Well above any plausible number of TVs in one home.
const MAX_BEACONS: usize = 64;
const MAX_NAME: usize = 48;
const MAX_PLATFORM: usize = 32;

// No I/O/0/1: the check string is read off a TV across a room and compared by
// eye, so the pairs that look alike in a sans-serif face are left out.
const CHECK_ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CHECK_LEN: usize = 4;

/// What a TV says about itself when it starts waiting for an account.
pub struct Announce {
    pub device_id: String,
    pub name: String,
    pub platform: String,
    pub ip: String,
}

/// What the TV needs to keep its beacon alive and collect the account.
pub struct Announced {
    pub handle: String,
    pub secret: String,
    pub check: String,
    pub ttl_secs: i64,
    pub poll_secs: i64,
}

/// One waiting TV, as a phone on the same network sees it. The address it
/// announced from stays server-side: the row travels, and knowing which TV is
/// nearby is the point; knowing where it sits is not.
pub struct Nearby {
    pub handle: String,
    pub name: String,
    pub platform: String,
    pub check: String,
}

struct Beacon {
    device_id: String,
    name: String,
    platform: String,
    ip: String,
    check: String,
}

pub struct HandoffInner {
    grants: Grants<Beacon>,
}

pub type Handoff = Arc<HandoffInner>;

pub fn new() -> Handoff {
    Arc::new(HandoffInner { grants: Grants::new(BEACON_TTL_SECS, MAX_BEACONS) })
}

impl HandoffInner {
    /// Publish (or republish) a TV's beacon. The same device replacing its own
    /// beacon drops the previous one, so a relaunched TV shows up once rather
    /// than twice; any tokens that beacon had accrued come back for deletion.
    pub fn announce(&self, req: Announce) -> (Announced, Vec<Orphaned>) {
        let device_id = req.device_id.clone();
        let orphans = self.grants.forget_where(|b| b.device_id == device_id);

        let check = check_string();
        let beacon = Beacon {
            device_id: req.device_id,
            name: clean_label(&req.name, MAX_NAME),
            platform: clean_label(&req.platform, MAX_PLATFORM),
            ip: req.ip,
            check: check.clone(),
        };
        let (handle, secret) = self.grants.insert(beacon, random_handle);
        let announced = Announced {
            handle,
            secret,
            check,
            ttl_secs: BEACON_TTL_SECS,
            poll_secs: POLL_SECS,
        };
        (announced, orphans)
    }

    /// Every TV waiting on `viewer_ip`'s own subnet, ordered so the list does not
    /// reshuffle between two polls.
    pub fn nearby(&self, viewer_ip: &str) -> Vec<Nearby> {
        let mut rows = self.grants.map_live(|handle, b| {
            same_subnet(&b.ip, viewer_ip).then(|| Nearby {
                handle: handle.to_string(),
                name: b.name.clone(),
                platform: b.platform.clone(),
                check: b.check.clone(),
            })
        });
        rows.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.handle.cmp(&b.handle)));
        rows
    }

    /// Hand `user`'s freshly-minted tokens to the TV behind `handle`. False when
    /// the handle is unknown, lapsed, or belongs to a TV that is not on the
    /// granting device's network. A caller may not learn which.
    pub fn grant(
        &self,
        handle: &str,
        viewer_ip: &str,
        user: User,
        token: String,
        access_token: String,
    ) -> bool {
        self.grants.authorize(
            handle,
            |b| same_subnet(&b.ip, viewer_ip),
            Granted { token, access_token, user },
        )
    }

    /// Poll by secret. Once granted, the beacon is consumed and its tokens +
    /// user returned.
    ///
    /// A TV that is polling is a TV that is still there, so the poll is also
    /// what keeps its beacon listed. There is no separate heartbeat that could
    /// stop while the poll carries on, or carry on after the poll stops.
    pub fn poll(&self, secret: &str) -> PollState {
        self.grants.touch(secret);
        self.grants.poll(secret)
    }

    /// Take a beacon down early (the TV signed in another way, or is quitting).
    pub fn forget(&self, secret: &str) -> Option<Orphaned> {
        self.grants.forget(secret)
    }
}

/// Whether two client addresses sit on the same link: same /24 for IPv4, same
/// /64 for IPv6. Two devices on one home network share it; a device reaching the
/// server through a tunnel, a VPN or the open internet does not.
///
/// Deliberately narrower than the LAN/WAN split: `192.168.0.0/16` spans a whole
/// building, and "the TVs I can see" has to mean the ones in this room's range.
pub fn same_subnet(a: &str, b: &str) -> bool {
    match (host(a), host(b)) {
        (Some(IpAddr::V4(a)), Some(IpAddr::V4(b))) => a.octets()[..3] == b.octets()[..3],
        (Some(IpAddr::V6(a)), Some(IpAddr::V6(b))) => a.octets()[..8] == b.octets()[..8],
        _ => false,
    }
}

// `::ffff:192.168.1.4` and `192.168.1.4` are one host reached over a dual-stack
// socket, so they have to compare as one family.
fn host(ip: &str) -> Option<IpAddr> {
    match ip.trim().parse().ok()? {
        IpAddr::V6(v6) => Some(v6.to_ipv4_mapped().map_or(IpAddr::V6(v6), IpAddr::V4)),
        v4 => Some(v4),
    }
}

fn check_string() -> String {
    random_bytes(CHECK_LEN)
        .into_iter()
        .map(|b| CHECK_ALPHABET[b as usize % CHECK_ALPHABET.len()] as char)
        .collect()
}

// Unguessable, and never read aloud: a phone only ever learns a handle by
// listing the beacons its own subnet can see.
fn random_handle() -> String {
    hex::encode(random_bytes(16))
}

#[cfg(test)]
mod tests {
    use super::*;

    const TV: &str = "192.168.1.20";
    const PHONE: &str = "192.168.1.50";
    const ELSEWHERE: &str = "10.0.0.7";

    fn user() -> User {
        crate::test_support::test_user("u1", vec![])
    }

    fn announce(h: &Handoff, device_id: &str, name: &str, ip: &str) -> Announced {
        let (announced, _) = h.announce(Announce {
            device_id: device_id.into(),
            name: name.into(),
            platform: "tvOS".into(),
            ip: ip.into(),
        });
        announced
    }

    #[test]
    fn a_phone_on_the_same_subnet_sees_the_waiting_tv() {
        let h = new();
        let announced = announce(&h, "tv-salon-01", "Salon", TV);
        let rows = h.nearby(PHONE);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Salon");
        assert_eq!(rows[0].platform, "tvOS");
        assert_eq!(rows[0].handle, announced.handle);
        // The check string is the TV's, so the two screens agree.
        assert_eq!(rows[0].check, announced.check);
    }

    #[test]
    fn a_phone_on_another_subnet_sees_nothing() {
        let h = new();
        announce(&h, "tv-salon-01", "Salon", TV);
        assert!(h.nearby(ELSEWHERE).is_empty());
    }

    #[test]
    fn granting_hands_the_tv_the_account_it_was_waiting_for() {
        let h = new();
        let tv = announce(&h, "tv-salon-01", "Salon", TV);
        assert!(matches!(h.poll(&tv.secret), PollState::Pending));
        assert!(h.grant(&tv.handle, PHONE, user(), "tok".into(), "acc".into()));

        let PollState::Authorized { token, access_token, user } = h.poll(&tv.secret) else {
            panic!("expected the granted session");
        };
        assert_eq!((token.as_str(), access_token.as_str()), ("tok", "acc"));
        assert_eq!(user.id, "u1");
    }

    #[test]
    fn a_handle_learned_elsewhere_is_useless_off_the_tvs_subnet() {
        let h = new();
        let tv = announce(&h, "tv-salon-01", "Salon", TV);
        assert!(!h.grant(&tv.handle, ELSEWHERE, user(), "tok".into(), "acc".into()));
        assert!(matches!(h.poll(&tv.secret), PollState::Pending));
    }

    #[test]
    fn an_unknown_handle_is_refused() {
        let h = new();
        assert!(!h.grant("deadbeef", PHONE, user(), "tok".into(), "acc".into()));
    }

    #[test]
    fn a_relaunched_tv_replaces_its_own_row_instead_of_adding_one() {
        let h = new();
        let first = announce(&h, "tv-salon-01", "Salon", TV);
        let second = announce(&h, "tv-salon-01", "Salon", TV);
        assert_ne!(first.handle, second.handle);
        assert_eq!(h.nearby(PHONE).len(), 1);
        assert!(matches!(h.poll(&first.secret), PollState::Unknown));
    }

    #[test]
    fn replacing_a_beacon_granted_in_the_gap_surrenders_its_tokens() {
        let h = new();
        let first = announce(&h, "tv-salon-01", "Salon", TV);
        assert!(h.grant(&first.handle, PHONE, user(), "tok".into(), "acc".into()));

        let (_, orphans) = h.announce(Announce {
            device_id: "tv-salon-01".into(),
            name: "Salon".into(),
            platform: "tvOS".into(),
            ip: TV.into(),
        });
        assert_eq!(orphans.len(), 1);
        assert_eq!(orphans[0].token, "tok");
    }

    #[test]
    fn two_tvs_are_listed_by_name_and_keep_that_order() {
        let h = new();
        announce(&h, "tv-chambre-01", "Chambre", TV);
        announce(&h, "tv-salon-01", "Salon", TV);
        let names: Vec<String> = h.nearby(PHONE).into_iter().map(|r| r.name).collect();
        assert_eq!(names, vec!["Chambre".to_string(), "Salon".to_string()]);
    }

    #[test]
    fn polling_keeps_a_beacon_listed_and_leaving_takes_it_down() {
        let h = new();
        let tv = announce(&h, "tv-salon-01", "Salon", TV);
        assert!(matches!(h.poll(&tv.secret), PollState::Pending));
        assert_eq!(h.nearby(PHONE).len(), 1);

        assert!(h.forget(&tv.secret).is_none());
        assert!(h.nearby(PHONE).is_empty());
        assert!(matches!(h.poll(&tv.secret), PollState::Unknown));
    }

    #[test]
    fn a_beacon_nobody_polls_lapses_out_of_the_list() {
        // A store whose entries are stale the instant they are filed: what the
        // TTL does to a TV that was unplugged, without waiting a minute for it.
        let h = Arc::new(HandoffInner { grants: Grants::new(0, MAX_BEACONS) });
        let tv = announce(&h, "tv-salon-01", "Salon", TV);
        assert!(h.nearby(PHONE).is_empty());
        assert!(matches!(h.poll(&tv.secret), PollState::Unknown));
    }

    #[test]
    fn a_tv_that_names_itself_with_a_newline_cannot_forge_a_row() {
        let h = new();
        h.announce(Announce {
            device_id: "tv-salon-01".into(),
            name: format!("Salon\nAdministrateur{}", "x".repeat(80)),
            platform: "  \u{7}tvOS  ".into(),
            ip: TV.into(),
        });
        let row = &h.nearby(PHONE)[0];
        assert!(!row.name.contains('\n'));
        assert_eq!(row.name.chars().count(), MAX_NAME);
        assert_eq!(row.platform, "tvOS");
    }

    #[test]
    fn the_check_string_is_short_and_free_of_look_alike_characters() {
        for _ in 0..64 {
            let check = check_string();
            assert_eq!(check.len(), CHECK_LEN);
            assert!(check.bytes().all(|b| CHECK_ALPHABET.contains(&b)), "{check}");
        }
    }

    #[test]
    fn handles_do_not_repeat() {
        let h = new();
        let mut seen = std::collections::HashSet::new();
        for i in 0..16 {
            let tv = announce(&h, &format!("tv-{i:04}-xxxx"), "Salon", TV);
            assert!(seen.insert(tv.handle), "handle repeated");
        }
    }

    #[test]
    fn same_subnet_holds_only_inside_one_link() {
        assert!(same_subnet("192.168.1.20", "192.168.1.50"));
        assert!(same_subnet("127.0.0.1", "127.0.0.1"));
        assert!(!same_subnet("192.168.1.20", "192.168.2.50"));
        assert!(!same_subnet("192.168.1.20", "10.0.0.7"));
        // A dual-stack socket reports the same host two ways.
        assert!(same_subnet("::ffff:192.168.1.20", "192.168.1.50"));
        // IPv6 compares on the /64 prefix.
        assert!(same_subnet("fd00:1234:5678:9abc::1", "fd00:1234:5678:9abc::2"));
        assert!(!same_subnet("fd00:1234:5678:9abc::1", "fd00:1234:5678:9abd::1"));
        // Families never match across, and an unparseable address matches nothing.
        assert!(!same_subnet("192.168.1.20", "fd00::1"));
        assert!(!same_subnet("not-an-ip", "192.168.1.50"));
        assert!(!same_subnet("192.168.1.20", ""));
    }

    #[test]
    fn announcing_is_capped_under_flood() {
        let h = new();
        for i in 0..(MAX_BEACONS + 40) {
            announce(&h, &format!("tv-flood-{i:04}"), "Salon", TV);
        }
        assert!(h.nearby(PHONE).len() <= MAX_BEACONS);
    }
}
