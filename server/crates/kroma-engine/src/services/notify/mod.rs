//! Notification delivery: who gets told, and how they hear about it.
//!
//! One entry point, [`emit`]. Producers describe WHAT happened (a
//! [`NotificationSpec`] of i18n keys, an image, a link, action buttons) and WHO
//! should hear about it (an [`Audience`]); everything after that resolving the
//! recipients, honouring their preferences, persisting a row and waking their
//! open clients is handled here, so no producer has to know about the inbox.
//!
//! Emission is synchronous and does DB work: call it from a blocking context
//! (`api::util::blocking`, a job thread), never inline in an async handler the
//! same rule the requests service follows.

pub mod art;
pub mod digest;
pub mod push;
pub mod render;

use kroma_db::notifications::StoredNotification;
use kroma_module_host::{Event, HostCtx};
use serde_json::json;

use kroma_domain::{Audience, NotificationSpec, User};

use crate::db;
use crate::services::jobs::now_ms;

/// Resolve an audience to the accounts that should receive this.
///
/// Returns full [`User`]s: the caller needs `language` to render for each
/// recipient, so re-fetching per id would be a query per notification.
fn resolve<S: HostCtx>(audience: &Audience, state: &S) -> anyhow::Result<Vec<User>> {
    // The single-recipient case is by far the most common (a request approved,
    // a report triaged) and has an indexed lookup; only the set-valued audiences
    // need the whole account list.
    if let Audience::User { id } = audience {
        return Ok(db::user_by_id(state.db(), id)?.into_iter().collect());
    }
    let conn = state.db().get()?;
    let all = db::notifications::recipients(&conn)?;
    Ok(match audience {
        Audience::User { .. } => unreachable!("handled above"),
        Audience::Permission { permission } => {
            all.into_iter().filter(|u| u.can(*permission)).collect()
        }
        Audience::Everyone => all,
        Audience::Followers { show_id } => {
            let ids: std::collections::HashSet<String> =
                db::notifications::followers_of_show(&conn, show_id)?.into_iter().collect();
            all.into_iter().filter(|u| ids.contains(&u.id)).collect()
        }
    })
}

/// Tell an audience that something happened.
///
/// Per recipient: skip if they muted the category, persist a row rendered in
/// their language on read, then wake their open clients with an addressed bus
/// event. Returns how many were actually notified.
///
/// Failures are contained per recipient a notification is never the point of
/// the operation that triggered it, so one bad row must not fail an approval.
pub fn emit<S: HostCtx>(state: &S, audience: &Audience, spec: &NotificationSpec) -> usize {
    let recipients = match resolve(audience, state) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(error = %e, event = spec.event.as_str(), "notify: cannot resolve audience");
            return 0;
        }
    };
    emit_to(state, &recipients, spec)
}

/// [`emit`] with the audience already resolved.
///
/// The digest announces many shows in one run; going through `emit` each time
/// would re-read the whole user table per show, so it resolves once and calls
/// this. The VAPID key and push subject are resolved here too, for the same
/// reason: they are per-server, not per-recipient.
pub fn emit_to<S: HostCtx>(state: &S, recipients: &[User], spec: &NotificationSpec) -> usize {
    if recipients.is_empty() {
        return 0;
    }
    let push = push::sender(state);
    let mut sent = 0;
    for user in recipients {
        match deliver(state, user, spec, &push) {
            Ok(true) => sent += 1,
            Ok(false) => {}
            Err(e) => {
                tracing::warn!(
                    error = %e, user = %user.id, event = spec.event.as_str(),
                    "notify: delivery failed"
                );
            }
        }
    }
    sent
}

/// Deliver to one recipient. `Ok(false)` means they have this category muted.
fn deliver<S: HostCtx>(
    state: &S,
    user: &User,
    spec: &NotificationSpec,
    push: &push::Sender,
) -> anyhow::Result<bool> {
    let category = spec.category();
    // One connection for the whole DB half of the delivery: the checks and the
    // insert run on it instead of taking two from the pool. It is released
    // before the push, which is blocking network I/O with bookkeeping of its own.
    let conn = state.db().get()?;
    let (in_app, push_allowed) = db::notifications::allows(&conn, &user.id, category)?;
    if !in_app {
        return Ok(false);
    }

    let now = now_ms();
    let id = crate::services::scan::short_hash(&format!(
        "notification|{}|{}|{}",
        user.id,
        spec.event.as_str(),
        crate::services::auth::random_token()
    ));
    // The row we are about to write, kept in hand: rendering the push below needs
    // exactly this, and re-SELECTing it would be a query plus two JSON parses for
    // data already sitting here.
    let stored = StoredNotification {
        id: id.clone(),
        category,
        event: spec.event,
        title_key: spec.title_key.clone(),
        body_key: spec.body_key.clone(),
        params: spec.params.clone(),
        link: spec.link.clone(),
        image_url: spec.image_url.clone(),
        actions: spec.actions.clone(),
        push_category: spec.push_category,
        read: false,
        created_at: now,
    };
    let unread = db::notifications::insert_notification(&conn, user.id.as_str(), &stored)?;

    // Wake this user's open clients. Addressed, so the bell on someone else's
    // browser does not tick for a notification that isn't theirs.
    state.publish_to(
        &user.id,
        Event::new("notification.created", json!({ "id": id, "unread": unread })),
    );

    // Then the device. Rendered in the recipient's own language, exactly like
    // the row they will see in the centre. Best effort by design: the row is
    // already written, so a push service being down costs a push, not the
    // notification.
    if push_allowed {
        // Sized on the way out: the device fetches this URL itself, over its own
        // network, and a lock-screen thumbnail has no use for the master (see
        // `art`).
        let rendered = art::sized_for_push(render::render(&stored, render::locale_of(user)));
        drop(conn);
        push::deliver(state, push, &user.id, &rendered);
    }
    Ok(true)
}

/// Tell a user's clients that their unread count moved (they read or deleted
/// something elsewhere), so a second open device updates its badge.
///
/// Takes the count rather than reading it: callers have just done the write that
/// changed it and already know the answer, which keeps this a pure bus publish
/// and therefore safe to call straight from an async handler.
pub fn publish_unread<S: HostCtx>(state: &S, user_id: &str, unread: u32) {
    state.publish_to(user_id, Event::new("notification.read", json!({ "unread": unread })));
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::sync::Mutex;

    use kroma_domain::{NotificationCategory, NotificationEvent, Permission};

    use super::*;
    use crate::test_support;

    /// A host that records what was published and to whom.
    struct RecordingHost {
        state: crate::state::SharedState,
        published: Mutex<Vec<(Option<String>, String)>>,
    }

    impl RecordingHost {
        fn new() -> Self {
            Self {
                state: test_support::test_state(),
                published: Mutex::new(Vec::new()),
            }
        }
        fn addressed(&self) -> Vec<(Option<String>, String)> {
            self.published.lock().unwrap().clone()
        }
    }

    impl HostCtx for RecordingHost {
        fn db(&self) -> &kroma_db::Pool {
            &self.state.db
        }
        fn data_dir(&self) -> &std::path::Path {
            self.state.data_dir()
        }
        fn require(&self, user: &User, perm: Permission) -> Result<(), axum::response::Response> {
            self.state.require(user, perm)
        }
        fn require_any_admin(&self, user: &User) -> Result<(), axum::response::Response> {
            self.state.require_any_admin(user)
        }
        fn lerr(
            &self,
            user: &User,
            status: axum::http::StatusCode,
            key: &str,
        ) -> axum::response::Response {
            self.state.lerr(user, status, key)
        }
        fn setting_str(&self, key: &str, default: &str) -> String {
            self.state.setting_str(key, default)
        }
        fn setting_bool(&self, key: &str, default: bool) -> bool {
            self.state.setting_bool(key, default)
        }
        fn setting_i64(&self, key: &str, default: i64) -> i64 {
            self.state.setting_i64(key, default)
        }
        fn set_settings(&self, patch: BTreeMap<String, serde_json::Value>) {
            self.state.set_settings(patch)
        }
        fn publish(&self, event: Event) {
            self.published.lock().unwrap().push((None, event.topic));
        }
        fn publish_to(&self, user_id: &str, event: Event) {
            self.published.lock().unwrap().push((Some(user_id.to_string()), event.topic));
        }
        fn notify(&self, audience: &Audience, spec: &NotificationSpec) -> usize {
            // Same routing as the real host, so a module-originated notification
            // is exercised by these tests too.
            emit(self, audience, spec)
        }
        fn trigger_job(&self, _key: &'static str, _reason: &'static str) {}
        fn module_enabled(&self, id: &str) -> bool {
            self.state.module_enabled(id)
        }
        fn library_folders(&self) -> Vec<kroma_module_host::LibraryFolders> {
            self.state.library_folders()
        }
        fn tmdb_api_key(&self) -> Option<String> {
            self.state.tmdb_api_key()
        }
        fn metadata_language(&self) -> String {
            self.state.metadata_language()
        }
        fn get_service(
            &self,
            type_id: std::any::TypeId,
        ) -> Option<std::sync::Arc<dyn std::any::Any + Send + Sync>> {
            self.state.get_service(type_id)
        }
    }

    fn spec() -> NotificationSpec {
        NotificationSpec::new(
            NotificationEvent::RequestApproved,
            "notifications.request.approved.title",
            "notifications.request.approved.body",
        )
        .param("title", "Dune")
    }

    fn user(host: &RecordingHost, email: &str, name: &str, perms: &[Permission]) -> String {
        kroma_db::create_user(host.db(), email, name, "h", perms).unwrap().id
    }

    #[test]
    fn emit_to_one_user_writes_a_row_and_wakes_only_them() {
        let host = RecordingHost::new();
        let ana = user(&host, "ana@t.dev", "Ana", &[]);
        let bo = user(&host, "bo@t.dev", "Bo", &[]);

        assert_eq!(emit(&host, &Audience::user(ana.clone()), &spec()), 1);

        let conn = host.db().get().unwrap();
        assert_eq!(db::notifications::unread_count(&conn, &ana).unwrap(), 1);
        assert_eq!(db::notifications::unread_count(&conn, &bo).unwrap(), 0);
        // And the bus event was addressed, not broadcast.
        assert_eq!(host.addressed(), vec![(Some(ana), "notification.created".to_string())]);
    }

    #[test]
    fn permission_audience_reaches_only_capability_holders() {
        let host = RecordingHost::new();
        let mod_ = user(&host, "mod@t.dev", "Mod", &[Permission::RequestsManage]);
        let plain = user(&host, "plain@t.dev", "Plain", &[Permission::Playback]);

        let sent = emit(&host, &Audience::permission(Permission::RequestsManage), &spec());
        assert_eq!(sent, 1);

        let conn = host.db().get().unwrap();
        assert_eq!(db::notifications::unread_count(&conn, &mod_).unwrap(), 1);
        assert_eq!(db::notifications::unread_count(&conn, &plain).unwrap(), 0);
    }

    #[test]
    fn everyone_audience_reaches_every_account() {
        let host = RecordingHost::new();
        let a = user(&host, "a@t.dev", "A", &[]);
        let b = user(&host, "b@t.dev", "B", &[]);
        assert_eq!(emit(&host, &Audience::Everyone, &spec()), 2);
        let conn = host.db().get().unwrap();
        assert_eq!(db::notifications::unread_count(&conn, &a).unwrap(), 1);
        assert_eq!(db::notifications::unread_count(&conn, &b).unwrap(), 1);
    }

    #[test]
    fn a_muted_category_is_skipped_without_a_row_or_an_event() {
        let host = RecordingHost::new();
        let ana = user(&host, "ana@t.dev", "Ana", &[]);
        db::notifications::set_prefs(
            host.db(),
            &ana,
            &[kroma_domain::CategoryPref {
                category: NotificationCategory::Requests,
                in_app: false,
                push: false,
            }],
        )
        .unwrap();

        assert_eq!(emit(&host, &Audience::user(ana.clone()), &spec()), 0);
        let conn = host.db().get().unwrap();
        assert_eq!(db::notifications::unread_count(&conn, &ana).unwrap(), 0);
        assert!(host.addressed().is_empty(), "muted user should not be woken");
    }

    #[test]
    fn muting_one_category_leaves_the_others_alone() {
        let host = RecordingHost::new();
        let ana = user(&host, "ana@t.dev", "Ana", &[]);
        db::notifications::set_prefs(
            host.db(),
            &ana,
            &[kroma_domain::CategoryPref {
                category: NotificationCategory::Media,
                in_app: false,
                push: false,
            }],
        )
        .unwrap();
        // The spec is a `requests` event, which is untouched by the media mute.
        assert_eq!(emit(&host, &Audience::user(ana), &spec()), 1);
    }

    #[test]
    fn an_unknown_user_id_notifies_nobody() {
        let host = RecordingHost::new();
        user(&host, "ana@t.dev", "Ana", &[]);
        assert_eq!(emit(&host, &Audience::user("ghost"), &spec()), 0);
        assert!(host.addressed().is_empty());
    }

    #[test]
    fn each_emission_mints_a_distinct_id() {
        let host = RecordingHost::new();
        let ana = user(&host, "ana@t.dev", "Ana", &[]);
        emit(&host, &Audience::user(ana.clone()), &spec());
        emit(&host, &Audience::user(ana.clone()), &spec());
        let conn = host.db().get().unwrap();
        // Two rows, not one clobbered by a colliding primary key.
        assert_eq!(db::notifications::unread_count(&conn, &ana).unwrap(), 2);
    }
}
