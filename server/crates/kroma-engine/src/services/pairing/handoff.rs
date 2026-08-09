//! Nearby handoff: a signed-out TV publishes a beacon, and a phone already
//! signed in picks that TV out of a list and hands its account over. Nothing to
//! scan, nothing to type.
//!
//! What keeps it safe is reach, not secrecy. A beacon is only ever listed to a
//! caller whose own address puts it on the same network as the TV that published
//! it, so "the TVs I can see" means "the TVs next to me" and never "every TV
//! this server knows". The handle a phone grants against is server-minted and
//! unguessable, the poll secret never leaves the TV, and the grant mints an
//! ordinary session that shows up in the account's device list like any other.
//!
//! Note what that does NOT require: that the server sit on their network. It is
//! a rendezvous, nothing more. A television and a telephone in the same room
//! pair through a server in another country, because the only address pair the
//! rule compares is theirs (see [`same_network`]).
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

// Announcing is unauthenticated by design (the TV has no account yet) and is
// reachable from wherever the server is, so the store is bounded twice. The
// per-network cap is the one that matters: a beacon is only ever visible to its
// own network, so nobody can push another network's TVs out of a phone's list by
// flooding. The global cap is the backstop behind it.
const MAX_BEACONS: usize = 256;
const MAX_PER_NETWORK: usize = 8;
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
        // Scoped to the network, not just to the id: a device id is not a secret
        // (it rides the cast roster too), so a global match would let anyone who
        // learned one drop that TV's beacon from anywhere. Inside its own
        // network the id is enough, and anyone there can do worse.
        let (device_id, ip) = (req.device_id.clone(), req.ip.clone());
        let mut orphans = self
            .grants
            .forget_where(|b| b.device_id == device_id && same_network(&b.ip, &ip));

        // Room for this one, taken from its own network's share rather than from
        // whatever the store happens to hold.
        orphans.extend(self.grants.trim_scope(MAX_PER_NETWORK, |b| same_network(&b.ip, &ip)));

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

    /// Every TV waiting on `viewer_ip`'s own network, ordered so the list does
    /// not reshuffle between two polls.
    pub fn nearby(&self, viewer_ip: &str) -> Vec<Nearby> {
        let mut rows = self.grants.map_live(|handle, b| {
            same_network(&b.ip, viewer_ip).then(|| Nearby {
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
            |b| same_network(&b.ip, viewer_ip),
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

/// Whether two client addresses put their devices on one network, as seen from
/// wherever the server happens to sit. That is the only question this feature
/// asks: the server is a rendezvous, and whether it shares a network with either
/// device is beside the point. A TV and a phone in the same room must find each
/// other through a server on the other side of the world.
///
/// Which makes the comparison depend on how the two got here:
///
/// - **Private IPv4** (the server is on their network, seeing them directly):
///   same /24. One home spans `192.168.1.20` on ethernet and `192.168.1.50` on
///   wifi, so equality would be too strict.
/// - **Public IPv4** (the server is elsewhere, seeing them through their NAT):
///   the very same address. A household leaves through one, so equality is what
///   "together" means here, and /24 across the open internet would be far too
///   loose.
/// - **IPv6**, either way: same /64. That is one prefix delegation, which is one
///   LAN, whether the addresses are unique-local or global.
///
/// Two limits worth knowing, both of which fall back to the code on the screen:
/// a home routed across several subnets, and a dual-stack home where one device
/// arrives over IPv6 and the other over IPv4.
pub fn same_network(a: &str, b: &str) -> bool {
    match (host(a), host(b)) {
        (Some(IpAddr::V4(a)), Some(IpAddr::V4(b))) if behind_one_router(&a) && behind_one_router(&b) => {
            a.octets()[..3] == b.octets()[..3]
        }
        (Some(IpAddr::V4(a)), Some(IpAddr::V4(b))) => a == b,
        (Some(IpAddr::V6(a)), Some(IpAddr::V6(b))) => a.octets()[..8] == b.octets()[..8],
        _ => false,
    }
}

// An address the server can only be seeing because it sits on the same network
// as its owner: nothing routes these across the internet.
fn behind_one_router(ip: &std::net::Ipv4Addr) -> bool {
    ip.is_private() || ip.is_loopback() || ip.is_link_local()
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
    // What one household looks like to a server that is not in it: both devices
    // leave through the same NAT, so both arrive wearing the same address.
    const HOUSEHOLD: &str = "203.0.113.7";
    const OTHER_HOUSEHOLD: &str = "203.0.113.9";

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
    fn a_server_somewhere_else_still_pairs_a_tv_and_a_phone_in_one_room() {
        // The server is on another network entirely, so it never sees either
        // device's own address: both arrive through their household's NAT.
        let h = new();
        let tv = announce(&h, "tv-salon-01", "Salon", HOUSEHOLD);

        assert_eq!(h.nearby(HOUSEHOLD).len(), 1);
        assert!(h.grant(&tv.handle, HOUSEHOLD, user(), "tok".into(), "acc".into()));
        assert!(matches!(h.poll(&tv.secret), PollState::Authorized { .. }));
    }

    #[test]
    fn a_phone_leaving_through_another_router_is_not_in_the_room() {
        let h = new();
        let tv = announce(&h, "tv-salon-01", "Salon", HOUSEHOLD);
        // Next door, or the same phone on cellular: a different way out.
        assert!(h.nearby(OTHER_HOUSEHOLD).is_empty());
        assert!(!h.grant(&tv.handle, OTHER_HOUSEHOLD, user(), "tok".into(), "acc".into()));
    }

    #[test]
    fn a_device_id_learned_elsewhere_cannot_drop_that_tvs_beacon() {
        let h = new();
        let mine = announce(&h, "tv-salon-01", "Salon", TV);
        // A device id is not a secret. Announcing it from another network must
        // not take my beacon down.
        announce(&h, "tv-salon-01", "Impostor", HOUSEHOLD);

        assert_eq!(h.nearby(PHONE).len(), 1);
        assert_eq!(h.nearby(PHONE)[0].name, "Salon");
        assert!(matches!(h.poll(&mine.secret), PollState::Pending));
    }

    #[test]
    fn one_network_cannot_crowd_another_out_of_the_store() {
        let h = new();
        for i in 0..(MAX_PER_NETWORK * 4) {
            announce(&h, &format!("tv-flood-{i:04}"), "Flood", HOUSEHOLD);
        }
        let mine = announce(&h, "tv-salon-01", "Salon", TV);

        // The flood is capped at its own network's share, and never touched mine.
        assert_eq!(h.nearby(HOUSEHOLD).len(), MAX_PER_NETWORK);
        assert_eq!(h.nearby(PHONE).len(), 1);
        assert!(matches!(h.poll(&mine.secret), PollState::Pending));
    }

    #[test]
    fn same_network_is_the_subnet_when_the_server_sees_them_directly() {
        // Private addresses: one home spans .20 on ethernet and .50 on wifi.
        assert!(same_network("192.168.1.20", "192.168.1.50"));
        assert!(same_network("127.0.0.1", "127.0.0.1"));
        assert!(!same_network("192.168.1.20", "192.168.2.50"));
        assert!(!same_network("192.168.1.20", "10.0.0.7"));
        // A dual-stack socket reports the same host two ways.
        assert!(same_network("::ffff:192.168.1.20", "192.168.1.50"));
    }

    #[test]
    fn same_network_is_the_very_address_when_the_server_is_elsewhere() {
        // Public IPv4: a household leaves through one address, so that address
        // IS the network. A /24 here would span strangers.
        assert!(same_network("203.0.113.7", "203.0.113.7"));
        assert!(!same_network("203.0.113.7", "203.0.113.9"));
        // A private address and a public one are never the same place, whichever
        // way round they come.
        assert!(!same_network("192.168.1.20", "203.0.113.7"));
        assert!(!same_network("203.0.113.7", "192.168.1.20"));
    }

    #[test]
    fn same_network_is_the_prefix_delegation_over_ipv6() {
        // One /64 is one LAN, unique-local or global alike.
        assert!(same_network("fd00:1234:5678:9abc::1", "fd00:1234:5678:9abc::2"));
        assert!(!same_network("fd00:1234:5678:9abc::1", "fd00:1234:5678:9abd::1"));
        assert!(same_network("2001:db8:1:2::1", "2001:db8:1:2::99"));
        assert!(!same_network("2001:db8:1:2::1", "2001:db8:1:3::1"));
    }

    #[test]
    fn an_address_that_is_not_one_is_nowhere() {
        // Families never match across, and an unparseable address matches nothing.
        assert!(!same_network("192.168.1.20", "fd00::1"));
        assert!(!same_network("not-an-ip", "192.168.1.50"));
        assert!(!same_network("192.168.1.20", ""));
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
