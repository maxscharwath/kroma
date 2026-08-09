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
        Self { map: Mutex::new(HashMap::new()), ttl_secs, capacity }
    }

    fn reap(&self, map: &mut HashMap<String, Entry<M>>) {
        let cutoff = now() - self.ttl_secs;
        map.retain(|_, e| e.fresh_at > cutoff);
    }

    fn handle_for(map: &HashMap<String, Entry<M>>, secret: &str) -> Option<String> {
        map.iter()
            .find(|(_, e)| ct_eq(e.secret.as_bytes(), secret.as_bytes()))
            .map(|(handle, _)| handle.clone())
    }

    /// File `meta` under the first free handle `mint` produces → `(handle,
    /// secret)`. At capacity the least recently active entry is evicted rather
    /// than the request refused: pairing always hands back a handle, and the
    /// evicted device simply asks again.
    pub fn insert(&self, meta: M, mut mint: impl FnMut() -> String) -> (String, String) {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        while map.len() >= self.capacity {
            let oldest = map
                .iter()
                .min_by_key(|(_, e)| e.seen)
                .map(|(handle, _)| handle.clone())
                .expect("a map at capacity holds at least one entry");
            map.remove(&oldest);
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
        (handle, secret)
    }

    /// Approve `handle` for a request whose metadata satisfies `allowed`. False
    /// when the handle is unknown, lapsed, or fails the predicate. All three
    /// answer "no such device", which is all a caller may learn.
    pub fn authorize(
        &self,
        handle: &str,
        allowed: impl Fn(&M) -> bool,
        granted: Granted,
    ) -> bool {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        match map.get_mut(handle) {
            Some(entry) if allowed(&entry.meta) => {
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

    /// Make room for one more entry matching `in_scope`, by forgetting the least
    /// recently active matches until fewer than `max` remain.
    ///
    /// This is what stops one caller crowding out the rest of an unauthenticated
    /// store: the global capacity alone would let whoever announces most often
    /// evict everyone else's requests.
    pub fn trim_scope(&self, max: usize, in_scope: impl Fn(&M) -> bool) -> Vec<Orphaned> {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        let mut scoped: Vec<(u64, String)> = map
            .iter()
            .filter(|(_, e)| in_scope(&e.meta))
            .map(|(handle, e)| (e.seen, handle.clone()))
            .collect();
        if scoped.len() < max {
            return Vec::new();
        }
        // Least recently active first, then drop as many as the newcomer needs.
        scoped.sort_unstable();
        let doomed = scoped.len() + 1 - max;
        scoped
            .into_iter()
            .take(doomed)
            .filter_map(|(_, handle)| map.remove(&handle))
            .filter_map(Entry::orphaned)
            .collect()
    }

    /// Forget every entry whose metadata matches, surrendering their tokens.
    pub fn forget_where(&self, doomed: impl Fn(&M) -> bool) -> Vec<Orphaned> {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        let handles: Vec<String> =
            map.iter().filter(|(_, e)| doomed(&e.meta)).map(|(h, _)| h.clone()).collect();
        handles.into_iter().filter_map(|h| map.remove(&h)).filter_map(Entry::orphaned).collect()
    }

    /// Project every live entry through `view`, dropping the `None`s.
    pub fn map_live<T>(&self, view: impl Fn(&str, &M) -> Option<T>) -> Vec<T> {
        let mut map = self.map.lock().unwrap();
        self.reap(&mut map);
        map.iter().filter_map(|(handle, e)| view(handle, &e.meta)).collect()
    }

    #[cfg(test)]
    pub(super) fn len(&self) -> usize {
        self.map.lock().unwrap().len()
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

    #[test]
    fn a_fresh_request_polls_pending_until_it_is_approved() {
        let g = grants();
        let (handle, secret) = g.insert("tv", seq_mint());
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
        let (handle, _) = g.insert("tv", seq_mint());
        assert!(matches!(g.poll("nope"), PollState::Unknown));
        assert!(!g.authorize("nope", |_| true, granted()));
        assert!(!g.touch("nope"));
        assert!(g.forget("nope").is_none());
        // A predicate that refuses reads exactly like an unknown handle.
        assert!(!g.authorize(&handle, |_| false, granted()));
    }

    #[test]
    fn mint_keeps_going_until_it_finds_a_free_handle() {
        let g = grants();
        let (first, _) = g.insert("tv", || "fixed".to_string());
        // A mint that keeps proposing a taken handle once, then a free one.
        let mut proposals = ["fixed".to_string(), "other".to_string()].into_iter();
        let (second, _) = g.insert("tv", move || proposals.next().expect("mint ran dry"));
        assert_eq!(first, "fixed");
        assert_eq!(second, "other");
    }

    #[test]
    fn the_least_recently_active_request_is_evicted_at_capacity() {
        let g = grants();
        let mut mint = seq_mint();
        let (_, first) = g.insert("tv", &mut mint);
        let (_, second) = g.insert("tv", &mut mint);
        g.insert("tv", &mut mint);
        g.insert("tv", &mut mint);
        // A heartbeat on the oldest moves it to the back of the eviction queue,
        // so the one that has been quiet longest goes instead.
        assert!(g.touch(&first));
        g.insert("tv", &mut mint);

        assert_eq!(g.len(), 4);
        assert!(matches!(g.poll(&first), PollState::Pending));
        assert!(matches!(g.poll(&second), PollState::Unknown));
    }

    #[test]
    fn a_lapsed_request_is_swept_on_the_next_touch_of_the_store() {
        let g: Grants<&str> = Grants::new(0, 4);
        let (_, secret) = g.insert("tv", seq_mint());
        assert!(matches!(g.poll(&secret), PollState::Unknown));
        assert_eq!(g.len(), 0);
    }

    #[test]
    fn a_heartbeat_carries_a_request_past_its_ttl() {
        let g = grants();
        let (_, secret) = g.insert("tv", seq_mint());
        assert!(g.touch(&secret));
        assert!(matches!(g.poll(&secret), PollState::Pending));
    }

    #[test]
    fn forgetting_surrenders_only_the_tokens_nobody_will_collect() {
        let g = grants();
        let (_, pending) = g.insert("tv", seq_mint());
        // Never approved: nothing was minted, so there is nothing to clean up.
        assert!(g.forget(&pending).is_none());

        let (handle, approved) = g.insert("tv", seq_mint());
        assert!(g.authorize(&handle, |_| true, granted()));
        let orphan = g.forget(&approved).expect("approved but never collected");
        assert_eq!((orphan.token.as_str(), orphan.access_token.as_str()), ("tok", "acc"));
        assert!(matches!(g.poll(&approved), PollState::Unknown));
    }

    #[test]
    fn forget_where_drops_every_match_and_leaves_the_rest() {
        let g = grants();
        let mut mint = seq_mint();
        let (doomed, _) = g.insert("old", &mut mint);
        let (_, kept) = g.insert("new", &mut mint);
        assert!(g.authorize(&doomed, |_| true, granted()));

        let orphans = g.forget_where(|meta| *meta == "old");
        assert_eq!(orphans.len(), 1);
        assert_eq!(g.len(), 1);
        assert!(matches!(g.poll(&kept), PollState::Pending));
    }

    #[test]
    fn trim_scope_bounds_one_scope_and_leaves_the_others_alone() {
        let g: Grants<&str> = Grants::new(300, 64);
        let mut mint = seq_mint();
        let (mine, mine_secret) = g.insert("theirs", &mut mint);
        for _ in 0..3 {
            g.insert("ours", &mut mint);
        }
        assert!(g.authorize(&mine, |_| true, granted()));

        // Under the cap: nothing goes.
        g.trim_scope(4, |m| *m == "ours");
        assert_eq!(g.len(), 4);

        // At it: the least recently active match goes, and only a match. It had
        // no tokens to surrender, so nothing comes back for deletion.
        assert!(g.trim_scope(3, |m| *m == "ours").is_empty());
        assert_eq!(g.len(), 3);
        assert!(matches!(g.poll(&mine_secret), PollState::Authorized { .. }));
    }

    #[test]
    fn trim_scope_surrenders_the_tokens_of_everything_it_drops() {
        let g: Grants<&str> = Grants::new(300, 64);
        let mut mint = seq_mint();
        let (first, _) = g.insert("ours", &mut mint);
        let (second, _) = g.insert("ours", &mut mint);
        assert!(g.authorize(&first, |_| true, granted()));
        assert!(g.authorize(&second, |_| true, granted()));

        // Room for one more out of a scope of two means dropping both.
        let orphans = g.trim_scope(1, |m| *m == "ours");
        assert_eq!(orphans.len(), 2);
        assert_eq!(g.len(), 0);
    }

    #[test]
    fn map_live_sees_every_entry_and_may_skip_some() {
        let g = grants();
        let mut mint = seq_mint();
        g.insert("keep", &mut mint);
        g.insert("skip", &mut mint);
        let mut seen = g.map_live(|handle, meta| (*meta == "keep").then(|| handle.to_string()));
        seen.sort();
        assert_eq!(seen, vec!["h1".to_string()]);
    }
}
