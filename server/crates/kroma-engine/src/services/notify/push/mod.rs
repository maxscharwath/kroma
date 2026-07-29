//! Push delivery: getting a notification onto a device whose app is closed.
//!
//! Three transports, one delivery loop. Each [`transports`] module answers two
//! questions the shared code cannot ask itself how to build this device's
//! request, and which failures mean the device is gone while the loop below
//! owns everything else: preferences, the success/failure streak, and evicting
//! dead endpoints.
//!
//! Web Push is the one that needs nothing from anyone: the server mints its own
//! VAPID keypair, so a NAS on a home LAN can push to a browser with no account
//! anywhere. APNs and FCM cannot work that way an Apple auth key and a
//! Firebase service account are per-developer secrets so those are configured
//! by the operator (see the admin settings) and simply stay inactive until they
//! are. A server with none of them configured does no push work at all.
//!
//! Delivery is best-effort and never blocks the thing that caused it: a push
//! that fails leaves the in-app notification exactly where it was.

mod transports;

use kroma_db::push_subs::{self, PushSubscription};
use kroma_module_host::HostCtx;
use kroma_push::webpush::VapidKey;
use kroma_push::Urgency;
use serde_json::json;

use kroma_domain::{
    Notification, NotificationCategory, NotificationEvent, User,
};

use crate::db;
use crate::services::jobs::now_ms;

/// Settings keys for the server's VAPID identity. Rotating these invalidates
/// every existing browser subscription, so they are written once and left alone.
pub const VAPID_PUBLIC_KEY: &str = "notifications.vapid.publicKey";
pub const VAPID_PRIVATE_KEY: &str = "notifications.vapid.privateKey";

/// Apple credentials. Unlike Web Push these CANNOT be self-minted, and no code
/// change will make them so: Apple's own servers only accept a JWT signed by a
/// `.p8` key THEY issued against a developer account and registered in their
/// portal. A locally generated key is signed by nobody they trust.
///
/// So the credential does not belong to a deployment — it belongs to the
/// published app, and every KROMA server pushes to that same app. It arrives
/// with the server (env, and later a relay that holds the key on our side)
/// rather than being typed in by whoever installed this NAS. The settings key
/// remains only as the escape hatch for a fork that ships its OWN app under its
/// own Apple account; see [`apns_credential`]. Absent = iOS push is simply off.
pub const APNS_KEY_P8: &str = "notifications.apns.keyP8";
/// The auth key's id — the `AuthKey_XXXXXXXXXX.p8` suffix, so an upload reads it
/// off the filename rather than asking for it.
pub const APNS_KEY_ID: &str = "notifications.apns.keyId";
/// The 10-character Apple team. The one thing a `.p8` genuinely cannot yield:
/// it is a bare PKCS#8 key with no metadata, and a wrong `iss` is rejected
/// outright, so a fork supplying its own key must supply this alongside it.
pub const APNS_TEAM_ID: &str = "notifications.apns.teamId";

/// The Firebase service-account JSON, for Android. Same story as APNs, with the
/// same escape hatch: absent = Android push is off.
pub const FCM_SERVICE_ACCOUNT: &str = "notifications.fcm.serviceAccount";

/// The published app's bundle id, sent as `apns-topic`. A constant rather than a
/// setting because it is the same string on every KROMA server in the world —
/// mirrors `bundleIdentifier` in `clients/mobile/app.json`. A fork that renames
/// the app overrides it with the rest of its credential bundle.
const APNS_TOPIC: &str = "tv.kroma.mobile";

/// Fallback contact when nothing better can be derived. A `mailto:` is required
/// to be present, not to be reachable; push services use it only for abuse
/// reports, and a self-hoster has no public address to offer.
const DEFAULT_SUBJECT: &str = "mailto:admin@kroma.invalid";

/// A credential supplied with the server rather than by the operator.
///
/// Env is read first so that a distribution — a container image, a package, the
/// relay — can carry the app's own Apple and Google keys and leave the admin
/// with nothing to fill in. The stored setting is the fallback, which is what a
/// fork shipping its own build writes to.
fn from_env_or_setting<S: HostCtx>(state: &S, var: &str, key: &str) -> String {
    match std::env::var(var) {
        Ok(v) if !v.trim().is_empty() => v.trim().to_string(),
        _ => state.setting_str(key, "").trim().to_string(),
    }
}

/// The server's VAPID public key, minting the keypair on first call.
///
/// Lazily created rather than at startup: a server whose users never enable push
/// never needs one, and generating it on demand keeps the key out of fresh
/// installs that will never use it.
pub fn public_key<S: HostCtx>(state: &S) -> anyhow::Result<String> {
    if let Some(key) = stored_key(state) {
        return Ok(key.public_base64url());
    }
    let key = VapidKey::generate();
    let public = key.public_base64url();
    state.set_settings(std::collections::BTreeMap::from([
        (VAPID_PUBLIC_KEY.to_string(), json!(public)),
        (VAPID_PRIVATE_KEY.to_string(), json!(key.private_base64url())),
    ]));
    tracing::info!("minted a VAPID keypair for Web Push");
    Ok(public)
}

/// The RFC 8292 `sub` claim — derived, never asked for.
///
/// A push service uses this only to have someone to contact about an abusive
/// sender; nothing validates that it is reachable, and it must merely be a
/// `mailto:` or `https:` URL. That makes it pure ceremony to put in front of an
/// admin, so it comes from the address the server already knows it answers on,
/// and from a syntactically valid placeholder when it has no public address at
/// all — which is the normal state for a NAS on a home LAN.
///
/// What it must never be is EMPTY: an empty `sub` is not the same as an absent
/// one, and FCM rejects the token outright.
fn subject_of<S: HostCtx>(state: &S) -> String {
    // The same `remoteUrl` the share and Quick Connect links are built from
    // (`settings::public_url`), read through the one accessor `HostCtx` offers.
    let public = state.setting_str("remoteUrl", "");
    let public = public.trim().trim_end_matches('/');
    if public.starts_with("https://") || public.starts_with("http://") {
        return public.to_string();
    }
    DEFAULT_SUBJECT.to_string()
}

fn stored_key<S: HostCtx>(state: &S) -> Option<VapidKey> {
    let private = state.setting_str(VAPID_PRIVATE_KEY, "");
    if private.is_empty() {
        return None;
    }
    match VapidKey::from_base64url(&private) {
        Ok(key) => Some(key),
        Err(e) => {
            // A corrupted key would otherwise fail every push forever with no
            // clue why; say so loudly and let the caller mint a fresh one.
            tracing::error!(error = %e, "stored VAPID key is unusable");
            None
        }
    }
}

/// Everything a push needs that is per-SERVER rather than per-recipient: the
/// configured transports and their credentials.
///
/// Built once per emission by [`sender`]. Resolving it per recipient meant a
/// settings read and a key parse each time, and `None` (nothing is configured)
/// short-circuits the whole branch before it queries a single subscription.
pub type Sender = transports::Senders;

/// The server's push identity, or `None` when no transport is configured at all
/// which is the normal state until someone subscribes a device.
pub fn sender<S: HostCtx>(state: &S) -> Option<Sender> {
    let senders = transports::Senders {
        web: stored_key(state)
            .map(|key| transports::WebPush { key, subject: subject_of(state) }),
        apns: apns_sender(state),
        fcm: fcm_sender(state),
    };
    // Always `Some`: the relay needs no credentials, so every server can reach a
    // phone even when it holds nothing of Apple's or Google's. The `Option`
    // remains because Web Push still depends on a key that may not exist yet.
    Some(senders)
}

/// The Apple sender, when this build was given an auth key.
///
/// Nothing here is asked of the operator. The key, its id and the team come as
/// one bundle from whoever publishes the app, and the topic is a constant
/// because every KROMA server pushes to that same published app.
///
/// The environment is deliberately absent: it is a property of each device
/// TOKEN, not of the server (see [`send_one`]).
fn apns_sender<S: HostCtx>(state: &S) -> Option<transports::Apns> {
    let p8 = from_env_or_setting(state, "KROMA_APNS_KEY_P8", APNS_KEY_P8);
    if p8.is_empty() {
        return None;
    }
    let topic = match std::env::var("KROMA_APNS_TOPIC") {
        Ok(v) if !v.trim().is_empty() => v.trim().to_string(),
        _ => APNS_TOPIC.to_string(),
    };
    let key = kroma_push::apns::ApnsKey::new(
        &p8,
        from_env_or_setting(state, "KROMA_APNS_KEY_ID", APNS_KEY_ID),
        from_env_or_setting(state, "KROMA_APNS_TEAM_ID", APNS_TEAM_ID),
        topic,
        // Where the FIRST attempt goes. A production token is the overwhelming
        // majority — every App Store and TestFlight install — so trying it first
        // means the fallback below costs a wasted request only while developing.
        kroma_push::apns::Environment::Production,
    );
    match key {
        Ok(key) => Some(transports::Apns { key }),
        Err(e) => {
            // Misconfigured credentials would otherwise fail every push with no
            // clue why; say it once per emission rather than per device.
            tracing::error!(error = %e, "APNs credentials are unusable; iOS push disabled");
            None
        }
    }
}

/// The Google sender, when a service account is configured AND an access token
/// can be obtained. The token exchange is a network call, so it happens here,
/// once per emission, rather than per device.
fn fcm_sender<S: HostCtx>(state: &S) -> Option<transports::Fcm> {
    let json = from_env_or_setting(state, "KROMA_FCM_SERVICE_ACCOUNT", FCM_SERVICE_ACCOUNT);
    if json.is_empty() {
        return None;
    }
    let key = match kroma_push::fcm::FcmKey::new(&json) {
        Ok(key) => key,
        Err(e) => {
            tracing::error!(error = %e, "FCM credentials are unusable; Android push disabled");
            return None;
        }
    };
    match fcm_access_token(&key) {
        Ok(access_token) => Some(transports::Fcm { key, access_token }),
        Err(e) => {
            tracing::warn!(error = %e, "could not obtain an FCM access token; Android push skipped");
            None
        }
    }
}

/// The cached OAuth2 token, or a fresh one traded for a signed assertion.
fn fcm_access_token(key: &kroma_push::fcm::FcmKey) -> anyhow::Result<String> {
    let now = now_ms() / 1_000;
    if let Some(token) = key.cached_token(now) {
        return Ok(token);
    }
    let request = key.token_request(now)?;
    let response = send(&request)?;
    if !(200..300).contains(&response.status) {
        anyhow::bail!("token endpoint returned {}: {}", response.status, response.text());
    }
    key.store_token(&response.text(), now)
}

/// Send one rendered notification to every endpoint `user_id` has registered.
///
/// Returns how many endpoints accepted it. Called after the in-app row is
/// already written, so any failure here costs a push, never the notification.
pub fn deliver<S: HostCtx>(
    state: &S,
    sender: &Sender,
    conn: &kroma_db::PooledConn,
    user_id: &str,
    notification: &Notification,
) -> usize {
    let subs = push_subs::subscriptions_for_user(conn, user_id).unwrap_or_default();
    if subs.is_empty() {
        return 0;
    }
    let payload = payload_of(notification);
    let out = transports::Outgoing {
        notification,
        web_payload: &payload,
        urgency: urgency_of(notification),
        actions: transports::native_actions(notification),
    };

    let mut sent = 0;
    for sub in subs {
        match send_one(state, sender, &sub, &out) {
            Ok(true) => sent += 1,
            Ok(false) => {}
            Err(e) => tracing::warn!(error = %e, endpoint = %sub.endpoint, "push failed"),
        }
    }
    sent
}

/// Send one "push is working" message to a user's own devices.
///
/// Lives here rather than in the api layer because composing a notification is
/// this service's job, and because the answer to "is my setup wired up?" should
/// exercise the very same path a real notification takes.
///
/// Deliberately bypasses the category preferences: the user just pressed the
/// button, so a muted category is not a reason to stay silent.
pub fn send_test<S: HostCtx>(state: &S, user: &User) -> anyhow::Result<usize> {
    let Some(sender) = sender(state) else {
        return Ok(0);
    };
    let locale = crate::i18n::user_locale(user);
    let notification = Notification {
        id: "test".into(),
        category: NotificationCategory::System,
        event: NotificationEvent::SystemTest,
        title: crate::i18n::t(locale, "notifications.test.title", &[]),
        body: crate::i18n::t(locale, "notifications.test.body", &[]),
        link: Some("/".into()),
        image_url: None,
        actions: Vec::new(),
        push_category: None,
        read: false,
        created_at: now_ms(),
    };
    let conn = state.db().get()?;
    Ok(deliver(state, &sender, &conn, &user.id, &notification))
}

/// Deliver to one endpoint, updating its health. `Ok(false)` = not delivered but
/// handled (dropped as gone, or a transport this server has no credentials for).
fn send_one<S: HostCtx>(
    state: &S,
    sender: &Sender,
    sub: &PushSubscription,
    out: &transports::Outgoing<'_>,
) -> anyhow::Result<bool> {
    let Some(mut request) = transports::build(sender, sub, out, now_ms() / 1_000)? else {
        return Ok(false); // transport not configured on this server
    };
    let mut response = send(&request)?;

    // Which APNs host a token belongs to is a fact about the DEVICE, not a
    // server-wide preference: one server can hold a TestFlight token and an
    // Xcode build's token at the same time, so no single setting can be right
    // for both. Rather than ask an admin to choose wrong, discover it — the
    // rejection is unambiguous, and the other host is one retry away.
    if sub.transport == kroma_domain::PushTransport::Apns
        && kroma_push::apns::is_wrong_environment(response.status, &response.text())
        && kroma_push::apns::flip_environment(&mut request)
    {
        tracing::debug!(endpoint = %sub.endpoint, "retrying push against the other APNs host");
        response = send(&request)?;
    }

    if (200..300).contains(&response.status) {
        let _ = push_subs::record_success(state.db(), &sub.id, now_ms());
        return Ok(true);
    }
    let body = response.text();
    if transports::is_gone(sub, response.status, &body) {
        // The app was uninstalled, the browser unsubscribed, or the token was
        // rotated. Permanent: keeping it costs requests and gets us rate-limited.
        tracing::info!(
            endpoint = %sub.endpoint, status = response.status,
            "dropping dead push endpoint"
        );
        let _ = push_subs::drop_subscription(state.db(), &sub.id);
        return Ok(false);
    }
    if push_subs::record_failure(state.db(), &sub.id).unwrap_or(false) {
        tracing::info!(endpoint = %sub.endpoint, "dropping push endpoint after repeated failures");
        let _ = push_subs::drop_subscription(state.db(), &sub.id);
    }
    anyhow::bail!("push service returned {} {body}", response.status)
}

/// Perform one built request over the curl transport.
///
/// `http2` is not a preference: APNs refuses HTTP/1.1 outright, so a request
/// that asks for it must get it or the send is pointless.
fn send(request: &kroma_push::PushRequest) -> anyhow::Result<kroma_http::Response> {
    let mut fetch = kroma_http::Fetch::new().max_time(15);
    if request.http2 {
        fetch = fetch.http2();
    }
    let mut content_type = "application/octet-stream";
    for (name, value) in &request.headers {
        if name.eq_ignore_ascii_case("content-type") {
            content_type = match value.as_str() {
                "application/json" => "application/json",
                "application/x-www-form-urlencoded" => "application/x-www-form-urlencoded",
                _ => "application/octet-stream",
            };
            continue; // `post_bytes` sets it; sending it twice confuses curl
        }
        fetch = fetch.header(name, value.clone());
    }
    fetch.post_bytes(&request.url, content_type, &request.body)
}

/// What the service worker receives: the notification's own wire shape.
///
/// Serialized straight from [`Notification`] rather than rebuilt field-by-field,
/// so a push and the notification-centre row it mirrors cannot drift apart —
/// renaming a field in the domain now changes both at once instead of silently
/// desyncing this copy. `sw.js` reads the fields it needs and ignores the rest.
fn payload_of(n: &Notification) -> Vec<u8> {
    serde_json::to_vec(n).unwrap_or_else(|_| b"{}".to_vec())
}

/// How hard to wake the device. Something the user is actively waiting for
/// (their request landed) is worth a radio wake; a media digest is not.
fn urgency_of(n: &Notification) -> Urgency {
    use kroma_domain::NotificationCategory as C;
    match n.category {
        C::Requests | C::Reports => Urgency::High,
        C::Downloads | C::System => Urgency::Normal,
        C::Media => Urgency::Low,
    }
}

/// Whether this user has any push endpoint (drives the settings toggle).
pub fn is_subscribed<S: HostCtx>(state: &S, user_id: &str) -> bool {
    let Ok(conn) = state.db().get() else { return false };
    db::push_subs::has_subscription(&conn, user_id).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use kroma_domain::{NotificationAction, NotificationCategory, NotificationEvent};

    fn notification(category: NotificationCategory) -> Notification {
        Notification {
            id: "n1".into(),
            category,
            event: NotificationEvent::RequestAvailable,
            title: "Ready to watch".into(),
            body: "Dune is now in your library.".into(),
            link: Some("/movie/ab12".into()),
            image_url: Some("https://img/p.jpg".into()),
            actions: vec![NotificationAction {
                id: "watch".into(),
                label: "Watch".into(),
                kind: kroma_domain::ActionKind::Link,
                href: "/movie/ab12".into(),
                method: None,
                style: kroma_domain::ActionStyle::Primary,
            }],
            push_category: None,
            read: false,
            created_at: 1_700_000_000_000,
        }
    }

    #[test]
    fn the_payload_mirrors_the_in_app_row() {
        let raw = payload_of(&notification(NotificationCategory::Requests));
        let v: serde_json::Value = serde_json::from_slice(&raw).unwrap();
        assert_eq!(v["id"], "n1");
        assert_eq!(v["title"], "Ready to watch");
        assert_eq!(v["link"], "/movie/ab12");
        assert_eq!(v["imageUrl"], "https://img/p.jpg");
        assert_eq!(v["category"], "requests");
        assert_eq!(v["event"], "request.available");
        assert_eq!(v["actions"][0]["id"], "watch");
        assert_eq!(v["actions"][0]["label"], "Watch");
    }

    #[test]
    fn the_payload_fits_a_single_push_record() {
        // Push services cap a message around 4 KiB; our own encoder caps at
        // MAX_PAYLOAD. A realistic notification must be nowhere near it.
        let raw = payload_of(&notification(NotificationCategory::Requests));
        assert!(raw.len() < kroma_push::webpush::MAX_PAYLOAD, "payload was {} bytes", raw.len());
    }

    #[test]
    fn the_subject_is_derived_and_never_empty() {
        // A server with no public address — the normal case for a NAS on a home
        // LAN — still needs a syntactically valid `sub`: an EMPTY one is not the
        // same as an absent one, and FCM rejects the token outright.
        let state = crate::test_support::test_state();
        assert_eq!(subject_of(&state), DEFAULT_SUBJECT);

        state.set_settings(std::collections::BTreeMap::from([(
            "remoteUrl".to_string(),
            json!("   "),
        )]));
        assert_eq!(subject_of(&state), DEFAULT_SUBJECT, "whitespace is still no address");

        // Once the server knows where it answers, that IS the contact — nobody
        // has to be asked for one.
        state.set_settings(std::collections::BTreeMap::from([(
            "remoteUrl".to_string(),
            json!("https://kroma.example.com/"),
        )]));
        assert_eq!(subject_of(&state), "https://kroma.example.com", "trailing slash trimmed");

        // A bare hostname is not a valid `sub`, so it must not be passed through.
        state.set_settings(std::collections::BTreeMap::from([(
            "remoteUrl".to_string(),
            json!("kroma.example.com"),
        )]));
        assert_eq!(subject_of(&state), DEFAULT_SUBJECT);
    }

    #[test]
    fn urgency_follows_how_much_the_user_is_waiting() {
        assert_eq!(urgency_of(&notification(NotificationCategory::Requests)), Urgency::High);
        assert_eq!(urgency_of(&notification(NotificationCategory::Reports)), Urgency::High);
        assert_eq!(urgency_of(&notification(NotificationCategory::Downloads)), Urgency::Normal);
        // A "12 new titles" digest should never wake a sleeping phone's radio.
        assert_eq!(urgency_of(&notification(NotificationCategory::Media)), Urgency::Low);
    }
}
