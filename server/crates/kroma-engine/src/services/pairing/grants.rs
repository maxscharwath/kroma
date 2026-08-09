//! The store both pairing flows share: a pending request filed under a public
//! handle, holding a private poll secret and whatever the flow needs to describe
//! itself, approved once by a signed-in account and collected exactly once.
//!
//! In-memory behind a `Mutex` and swept by TTL on every access: a pairing that
//! did not complete inside its window is worth nothing, so nothing here outlives
//! a restart.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use crate::model::User;
use crate::services::auth::{ct_eq, random_token};

/// The tokens a device collects on the poll that finds its request approved.
pub struct Granted {
    pub token: String,
    pub access_token: String,
    pub user: User,
}

/// What a poll by secret found. `Unknown` covers both "never existed" and
/// "lapsed": a device that cannot tell them apart simply starts over.
pub enum PollState {
    Pending,
    Authorized { token: String, access_token: String, user: Box<User> },
    Unknown,
}

/// Tokens minted for a request nobody will ever collect: approved in the gap
/// before the device rotated or dropped its handle. The caller deletes them.
pub struct Orphaned {
    pub token: String,
    pub access_token: String,
}

struct Entry<M> {
    secret: String,
    fresh_at: i64,
    // Bumped on every insert and heartbeat. `fresh_at` has second granularity,
    // so under the flood that eviction exists for every entry shares a
    // timestamp; this is what still orders them least-recently-active first.
    seen: u64,
    meta: M,
    granted: Option<Granted>,
}

impl<M> Entry<M> {
    fn orphaned(self) -> Option<Orphaned> {
        let g = self.granted?;
        Some(Orphaned { token: g.token, access_token: g.access_token })
    }
}

pub struct Grants<M> {
    map: Mutex<HashMap<String, Entry<M>>>,
    // Tokens belonging to entries that left without anyone asking: swept by the
    // TTL, or evicted. Every OTHER removal path hands its `Orphaned` back to the
    // caller directly; these two have no caller to hand them to, and the tokens
    // are real rows in SQLite that nothing else will ever delete. Drained by
    // `take_orphans` from the HTTP layer, which knows how to delete them.
    orphanage: Mutex<Vec<Orphaned>>,
    ttl_secs: i64,
    capacity: usize,
}

fn now() -> i64 {
    time::OffsetDateTime::now_utc().unix_timestamp()
}

static SEEN: AtomicU64 = AtomicU64::new(0);

fn tick() -> u64 {
    SEEN.fetch_add(1, Ordering::Relaxed)
}

impl<M> Grants<M> {
    /// `capacity` bounds an endpoint that is unauthenticated by design against a
    /// flood, and keeps the map sparse enough that a small handle keyspace still
    /// mints collision-free. It must be at least 1: the store evicts to make
    /// room, and a store with no room to make cannot hold the request it was
    /// just handed.
    pub fn new(ttl_secs: i64, capacity: usize) -> Self {
        debug_assert!(capacity > 0, "a grant store with no capacity can hold nothing");
        Self {
            map: Mutex::new(HashMap::new()),
            orphanage: Mutex::new(Vec::new()),
            ttl_secs,
            capacity,
        }
    }

    fn reap(&self, map: &mut HashMap<String, Entry<M>>) {
        let cutoff = now() - self.ttl_secs;
        let lapsed: Vec<String> =
            map.iter().filter(|(_, e)| e.fresh_at <= cutoff).map(|(h, _)| h.clone()).collect();
        for handle in lapsed {
            self.abandon(map.remove(&handle));
        }
    }

    // A device that was approved and then never came back still had tokens
    // minted for it. Losing the entry must not lose them.
    fn abandon(&self, entry: Option<Entry<M>>) {
        if let Some(orphan) = entry.and_then(Entry::orphaned) {
            self.orphanage.lock().unwrap().push(orphan);
        }
    }

    /// Take the tokens of everything that lapsed or was evicted since the last
    /// call, for the caller to delete. Empty almost always.
    pub fn take_orphans(&self) -> Vec<Orphaned> {
        std::mem::take(&mut *self.orphanage.lock().unwrap())
    }

    fn handle_for(map: &HashMap<String, Entry<M>>, secret: &str) -> Option<String> {
        map.iter()
            .find(|(_, e)| ct_eq(e.secret.as_bytes(), secret.as_bytes()))
            .map(|(handle, _)| handle.clone())
    }

    /// File `meta` under the first free handle `mint` produces → `(handle,
    /// secret)`, or None when the store is full.
    ///
    /// Full REFUSES rather than evicting. Eviction is what an unauthenticated
    /// endpoint must not do: whoever calls most often would otherwise decide
    /// whose pairing survives, and a few requests a second would keep every
    /// honest device out of every list. A caller that wants room should make it
    /// among its own entries first (see [`Self::forget_where`]).
    pub fn insert(&self, meta: M, mut mint: impl FnMut() -> String) -> Option<(String, String)> {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        if map.len() >= self.capacity {
            return None;
        }
        let handle = loop {
            let candidate = mint();
            if !map.contains_key(&candidate) {
                break candidate;
            }
        };
        let secret = random_token();
        map.insert(
            handle.clone(),
            Entry { secret: secret.clone(), fresh_at: now(), seen: tick(), meta, granted: None },
        );
        Some((handle, secret))
    }

    /// How many live entries match, so a caller can bound its own share before
    /// asking for room it will not get.
    pub fn count(&self, matching: impl Fn(&M) -> bool) -> usize {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        map.values().filter(|e| matching(&e.meta)).count()
    }

    /// Approve `handle` for a request whose metadata satisfies `allowed`. False
    /// when the handle is unknown, lapsed, fails the predicate, or was ALREADY
    /// approved. All four answer "no such device", which is all a caller may
    /// learn.
    ///
    /// Refusing the second approval is what makes this one-shot in both
    /// directions. Overwriting would silently discard the first approver's
    /// tokens (rows in SQLite that nothing would then delete) and hand the
    /// device to whoever asked last, which is not a race a pairing flow should
    /// have: two phones can see one waiting television, and so can one phone
    /// twice.
    pub fn authorize(&self, handle: &str, allowed: impl Fn(&M) -> bool, granted: Granted) -> bool {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        match map.get_mut(handle) {
            Some(entry) if entry.granted.is_none() && allowed(&entry.meta) => {
                entry.granted = Some(granted);
                true
            }
            _ => false,
        }
    }

    /// Poll by secret. An approved entry is consumed, so its tokens are handed
    /// out exactly once.
    pub fn poll(&self, secret: &str) -> PollState {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        let Some(handle) = Self::handle_for(&map, secret) else {
            return PollState::Unknown;
        };
        match map.get(&handle).and_then(|e| e.granted.as_ref()) {
            Some(_) => {
                let granted = map.remove(&handle).and_then(|e| e.granted).expect("just matched");
                PollState::Authorized {
                    token: granted.token,
                    access_token: granted.access_token,
                    user: Box::new(granted.user),
                }
            }
            None => PollState::Pending,
        }
    }

    /// Keep the entry holding `secret` alive for another TTL. False when it is
    /// already gone, which tells its device to announce itself again.
    pub fn touch(&self, secret: &str) -> bool {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        let Some(handle) = Self::handle_for(&map, secret) else {
            return false;
        };
        map.entry(handle).and_modify(|e| {
            e.fresh_at = now();
            e.seen = tick();
        });
        true
    }

    /// Forget the entry holding `secret`, surrendering any tokens it accrued.
    pub fn forget(&self, secret: &str) -> Option<Orphaned> {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        let handle = Self::handle_for(&map, secret)?;
        map.remove(&handle)?.orphaned()
    }

    /// Forget every entry whose metadata matches, surrendering their tokens.
    pub fn forget_where(&self, doomed: impl Fn(&M) -> bool) -> Vec<Orphaned> {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        let handles: Vec<String> =
            map.iter().filter(|(_, e)| doomed(&e.meta)).map(|(h, _)| h.clone()).collect();
        handles.into_iter().filter_map(|h| map.remove(&h)).filter_map(Entry::orphaned).collect()
    }

    /// Project every live entry NOT yet approved through `view`, dropping the
    /// `None`s.
    ///
    /// Approved-but-uncollected is deliberately excluded: such an entry is spent
    /// (the second approval is refused) and its device is a few seconds from
    /// signing in, so listing it offers a row that can only fail.
    pub fn map_pending<T>(&self, view: impl Fn(&str, &M) -> Option<T>) -> Vec<T> {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        map.iter()
            .filter(|(_, e)| e.granted.is_none())
            .filter_map(|(handle, e)| view(handle, &e.meta))
            .collect()
    }

    #[cfg(test)]
    pub(super) fn len(&self) -> usize {
        self.map.lock().unwrap().len()
    }

    /// Test seam: push every entry `secs` further into the past, so a sweep can
    /// be watched without one.
    #[cfg(test)]
    pub(super) fn age(&self, secs: i64) {
        for entry in self.map.lock().unwrap().values_mut() {
            entry.fresh_at -= secs;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user() -> User {
        crate::test_support::test_user("u1", vec![])
    }

    fn granted() -> Granted {
        Granted { token: "tok".into(), access_token: "acc".into(), user: user() }
    }

    fn grants() -> Grants<&'static str> {
        Grants::new(300, 4)
    }

    fn seq_mint() -> impl FnMut() -> String {
        let mut n = 0;
        move || {
            n += 1;
            format!("h{n}")
        }
    }

    fn file(g: &Grants<&'static str>, meta: &'static str, mint: impl FnMut() -> String) -> (String, String) {
        g.insert(meta, mint).expect("room in the store")
    }

    #[test]
    fn a_fresh_request_polls_pending_until_it_is_approved() {
        let g = grants();
        let (handle, secret) = file(&g, "tv", seq_mint());
        assert!(matches!(g.poll(&secret), PollState::Pending));
        assert!(g.authorize(&handle, |_| true, granted()));
        let PollState::Authorized { token, access_token, user } = g.poll(&secret) else {
            panic!("expected an approved request");
        };
        assert_eq!((token.as_str(), access_token.as_str()), ("tok", "acc"));
        assert_eq!(user.id, "u1");
        // Collected exactly once: the entry is gone on the next poll.
        assert!(matches!(g.poll(&secret), PollState::Unknown));
    }

    #[test]
    fn an_unknown_secret_or_handle_is_refused_without_saying_why() {
        let g = grants();
        let (handle, _) = file(&g, "tv", seq_mint());
        assert!(matches!(g.poll("nope"), PollState::Unknown));
        assert!(!g.authorize("nope", |_| true, granted()));
        assert!(!g.touch("nope"));
        assert!(g.forget("nope").is_none());
        // A predicate that refuses reads exactly like an unknown handle.
        assert!(!g.authorize(&handle, |_| false, granted()));
    }

    #[test]
    fn approval_happens_once_and_the_second_asker_is_refused() {
        // Two phones can see one waiting television, and one phone can be
        // tapped twice. Overwriting would discard the first approver's tokens,
        // which are rows nothing else would ever delete, and hand the device to
        // whoever asked last.
        let g = grants();
        let (handle, secret) = file(&g, "tv", seq_mint());
        assert!(g.authorize(&handle, |_| true, granted()));

        let second =
            Granted { token: "tok2".into(), access_token: "acc2".into(), user: user() };
        assert!(!g.authorize(&handle, |_| true, second));

        let PollState::Authorized { token, .. } = g.poll(&secret) else {
            panic!("expected the FIRST approval");
        };
        assert_eq!(token, "tok");
    }

    #[test]
    fn mint_keeps_going_until_it_finds_a_free_handle() {
        let g = grants();
        let (first, _) = file(&g, "tv", || "fixed".to_string());
        let mut proposals = ["fixed".to_string(), "other".to_string()].into_iter();
        let (second, _) = file(&g, "tv", move || proposals.next().expect("mint ran dry"));
        assert_eq!(first, "fixed");
        assert_eq!(second, "other");
    }

    #[test]
    fn a_full_store_refuses_rather_than_evicting_someone() {
        // Eviction on an endpoint nobody authenticates to would let whoever
        // asks most often decide whose pairing survives.
        let g = grants();
        let mut mint = seq_mint();
        let (_, first) = file(&g, "tv", &mut mint);
        for _ in 0..3 {
            file(&g, "tv", &mut mint);
        }
        assert_eq!(g.len(), 4);

        assert!(g.insert("tv", &mut mint).is_none());
        assert_eq!(g.len(), 4);
        // And the one that was already there is untouched.
        assert!(matches!(g.poll(&first), PollState::Pending));
    }

    #[test]
    fn a_lapsed_request_is_swept_on_the_next_touch_of_the_store() {
        let g: Grants<&str> = Grants::new(0, 4);
        let (_, secret) = file(&g, "tv", seq_mint());
        assert!(matches!(g.poll(&secret), PollState::Unknown));
        assert_eq!(g.len(), 0);
    }

    #[test]
    fn a_request_swept_after_it_was_approved_surrenders_its_tokens() {
        // The device was approved and then never came back: unplugged, or its
        // wifi went. The tokens minted for it are real rows in SQLite, and
        // losing the entry must not lose them.
        let g = grants();
        let (handle, _) = file(&g, "tv", seq_mint());
        assert!(g.authorize(&handle, |_| true, granted()));
        assert!(g.take_orphans().is_empty(), "nothing has lapsed yet");

        g.age(400);
        assert!(matches!(g.poll("anything"), PollState::Unknown), "the sweep ran");

        let orphans = g.take_orphans();
        assert_eq!(orphans.len(), 1, "the swept approval surrendered its tokens");
        assert_eq!(orphans[0].token, "tok");
        assert!(g.take_orphans().is_empty(), "draining twice yields nothing");
    }

    #[test]
    fn a_request_swept_before_anyone_approved_it_surrenders_nothing() {
        let g = grants();
        file(&g, "tv", seq_mint());
        g.age(400);
        assert!(matches!(g.poll("anything"), PollState::Unknown));
        assert!(g.take_orphans().is_empty(), "no tokens were ever minted");
    }

    #[test]
    fn a_heartbeat_carries_a_request_past_its_ttl() {
        let g = grants();
        let (_, secret) = file(&g, "tv", seq_mint());
        assert!(g.touch(&secret));
        assert!(matches!(g.poll(&secret), PollState::Pending));
    }

    #[test]
    fn forgetting_surrenders_only_the_tokens_nobody_will_collect() {
        let g = grants();
        let (_, pending) = file(&g, "tv", seq_mint());
        assert!(g.forget(&pending).is_none());

        let (handle, approved) = file(&g, "tv", seq_mint());
        assert!(g.authorize(&handle, |_| true, granted()));
        let orphan = g.forget(&approved).expect("approved but never collected");
        assert_eq!((orphan.token.as_str(), orphan.access_token.as_str()), ("tok", "acc"));
        assert!(matches!(g.poll(&approved), PollState::Unknown));
    }

    #[test]
    fn forget_where_drops_every_match_and_leaves_the_rest() {
        let g = grants();
        let mut mint = seq_mint();
        let (doomed, _) = file(&g, "old", &mut mint);
        let (_, kept) = file(&g, "new", &mut mint);
        assert!(g.authorize(&doomed, |_| true, granted()));

        let orphans = g.forget_where(|meta| *meta == "old");
        assert_eq!(orphans.len(), 1);
        assert_eq!(g.len(), 1);
        assert!(matches!(g.poll(&kept), PollState::Pending));
    }

    #[test]
    fn map_pending_sees_what_is_still_waiting_and_may_skip_some() {
        let g = grants();
        let mut mint = seq_mint();
        file(&g, "keep", &mut mint);
        file(&g, "skip", &mut mint);
        let mut seen = g.map_pending(|handle, meta| (*meta == "keep").then(|| handle.to_string()));
        seen.sort();
        assert_eq!(seen, vec!["h1".to_string()]);
    }

    #[test]
    fn map_pending_hides_a_request_already_approved() {
        // Its device is seconds from signing in and the second approval is
        // refused, so offering the row again can only fail.
        let g = grants();
        let (handle, _) = file(&g, "tv", seq_mint());
        assert_eq!(g.map_pending(|h, _| Some(h.to_string())).len(), 1);

        assert!(g.authorize(&handle, |_| true, granted()));
        assert!(g.map_pending(|h, _| Some(h.to_string())).is_empty());
    }

    #[test]
    fn count_answers_for_a_slice_of_the_store() {
        let g = grants();
        let mut mint = seq_mint();
        file(&g, "mine", &mut mint);
        file(&g, "mine", &mut mint);
        file(&g, "theirs", &mut mint);
        assert_eq!(g.count(|m| *m == "mine"), 2);
        assert_eq!(g.count(|m| *m == "theirs"), 1);
        assert_eq!(g.count(|_| true), 3);
    }
}
