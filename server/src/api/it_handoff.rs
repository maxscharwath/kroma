//! Integration tests for the nearby-handoff surface (`src/api/handoff.rs`): a
//! signed-out TV announcing itself, a signed-in phone listing it and granting
//! its account, and the refusals that keep the feature to one network. The
//! whole point is that reach, not a code, is what authorizes the handoff.
//!
//! The harness peers from loopback, so `x-forwarded-for` is how a test says
//! "this call came from somewhere else" (`client_ip` trusts the header only
//! behind a loopback peer, which is exactly the local-reverse-proxy case).

use axum::http::StatusCode;
use serde_json::{json, Value};

use crate::api::test_support::{get, raw, send, test_app, TestApp};

const TV_IP: &str = "192.168.1.20";
const PHONE_IP: &str = "192.168.1.50";
const OTHER_SUBNET: &str = "192.168.9.9";
const WAN_IP: &str = "8.8.8.8";

async fn from(
    t: &TestApp,
    method: &str,
    uri: &str,
    token: Option<&str>,
    body: Option<Value>,
    ip: &str,
) -> (StatusCode, Value) {
    let (status, _headers, value) =
        raw(&t.app, method, uri, token, body, &[("x-forwarded-for", ip)]).await;
    (status, value)
}

async fn announce(t: &TestApp, device_id: &str, name: &str, ip: &str) -> Value {
    let body = json!({ "deviceId": device_id, "name": name, "platform": "tvOS" });
    let (status, reply) = from(t, "POST", "/api/handoff/announce", None, Some(body), ip).await;
    assert_eq!(status, StatusCode::OK, "announce refused: {reply}");
    reply
}

fn secret(beacon: &Value) -> String {
    beacon["secret"].as_str().expect("a poll secret").to_string()
}

async fn poll(t: &TestApp, beacon: &Value) -> Value {
    let (status, body) =
        get(&t.app, &format!("/api/handoff/poll?secret={}", secret(beacon)), None).await;
    assert_eq!(status, StatusCode::OK);
    body
}

async fn poll_status(t: &TestApp, beacon: &Value) -> String {
    poll(t, beacon).await["status"].as_str().unwrap_or_default().to_string()
}

async fn session_count(t: &TestApp) -> usize {
    let (_, list) = get(&t.app, "/api/auth/me/sessions", Some(&t.token)).await;
    list.as_array().map(Vec::len).unwrap_or(0)
}

#[tokio::test]
async fn a_phone_signs_a_waiting_tv_in_by_picking_it_from_the_list() {
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", TV_IP).await;
    assert_eq!(beacon["check"].as_str().map(str::len), Some(4));
    assert!(beacon["pollSecs"].as_i64().unwrap_or(0) < beacon["ttlSecs"].as_i64().unwrap_or(0));
    assert_eq!(poll_status(&t, &beacon).await, "pending");

    let (status, list) =
        from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, PHONE_IP).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(list.as_array().map(Vec::len), Some(1));
    assert_eq!(list[0]["name"], "Salon");
    assert_eq!(list[0]["platform"], "tvOS");
    // The two screens show the same check string, and the row carries nothing
    // about where the TV sits.
    assert_eq!(list[0]["check"], beacon["check"]);
    assert!(list[0].get("ip").is_none());

    let grant = json!({ "handle": list[0]["handle"] });
    let (status, _) =
        from(&t, "POST", "/api/handoff/grant", Some(&t.token), Some(grant), PHONE_IP).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let granted = poll(&t, &beacon).await;
    assert_eq!(granted["status"], "authorized");
    assert_eq!(granted["user"]["username"], "owner");

    // The TV's new session is an ordinary one: it works, and it is listed with
    // the account's other devices so it can be revoked like any other.
    let tv_token = granted["token"].as_str().expect("a session token");
    let (status, me) = get(&t.app, "/api/auth/me", Some(tv_token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(me["user"]["username"], "owner");

    // Collected exactly once: the beacon is gone from both the poll and the list.
    assert_eq!(poll_status(&t, &beacon).await, "expired");
    let (_, list) = from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, PHONE_IP).await;
    assert_eq!(list.as_array().map(Vec::len), Some(0));
}

#[tokio::test]
async fn a_tv_off_the_local_network_may_not_announce_itself() {
    let t = test_app();
    let body = json!({ "deviceId": "tv-salon-01", "name": "Salon", "platform": "tvOS" });
    let (status, _) = from(&t, "POST", "/api/handoff/announce", None, Some(body), WAN_IP).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn a_phone_off_the_local_network_is_shown_no_tvs_and_may_not_grant() {
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", TV_IP).await;
    let handle = beacon["handle"].clone();

    // Not an error a scanner could read: the same empty list as "nothing waiting".
    let (status, list) = from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, WAN_IP).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(list.as_array().map(Vec::len), Some(0));

    let before = session_count(&t).await;
    let (status, _) = from(
        &t,
        "POST",
        "/api/handoff/grant",
        Some(&t.token),
        Some(json!({ "handle": handle })),
        WAN_IP,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(poll_status(&t, &beacon).await, "pending");
    assert_eq!(session_count(&t).await, before, "a refused grant minted a session");
}

#[tokio::test]
async fn a_handle_learned_elsewhere_is_useless_from_another_subnet() {
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", TV_IP).await;

    // Local enough to use the feature, but not on the TV's own link.
    let (status, list) =
        from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, OTHER_SUBNET).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(list.as_array().map(Vec::len), Some(0));

    let before = session_count(&t).await;
    let (status, _) = from(
        &t,
        "POST",
        "/api/handoff/grant",
        Some(&t.token),
        Some(json!({ "handle": beacon["handle"] })),
        OTHER_SUBNET,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(poll_status(&t, &beacon).await, "pending");
    // The tokens minted for a grant that was then refused are cleaned up.
    assert_eq!(session_count(&t).await, before);
}

#[tokio::test]
async fn granting_a_handle_that_never_existed_is_refused() {
    let t = test_app();
    let before = session_count(&t).await;
    let (status, _) = from(
        &t,
        "POST",
        "/api/handoff/grant",
        Some(&t.token),
        Some(json!({ "handle": "deadbeef" })),
        PHONE_IP,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(session_count(&t).await, before);
}

#[tokio::test]
async fn a_device_id_that_is_not_a_device_id_is_refused() {
    let t = test_app();
    for bad in ["short", "../../etc/passwd", "tv salon 01"] {
        let body = json!({ "deviceId": bad, "name": "Salon" });
        let (status, _) = from(&t, "POST", "/api/handoff/announce", None, Some(body), TV_IP).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "accepted {bad}");
    }
}

#[tokio::test]
async fn a_beacon_lives_while_the_tv_polls_and_ends_when_it_leaves() {
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", TV_IP).await;

    // Polling is the liveness signal: still pending, still listed.
    assert_eq!(poll_status(&t, &beacon).await, "pending");
    let (_, list) = from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, PHONE_IP).await;
    assert_eq!(list.as_array().map(Vec::len), Some(1));

    let body = json!({ "secret": secret(&beacon) });
    let (status, _) = send(&t.app, "POST", "/api/handoff/leave", None, Some(body)).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(poll_status(&t, &beacon).await, "expired");

    let (_, list) = from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, PHONE_IP).await;
    assert_eq!(list.as_array().map(Vec::len), Some(0));
}

#[tokio::test]
async fn a_tv_re_announcing_replaces_its_own_row_rather_than_adding_one() {
    let t = test_app();
    let first = announce(&t, "tv-salon-01", "Salon", TV_IP).await;
    let body = json!({
        "deviceId": "tv-salon-01",
        "name": "Salon",
        "platform": "tvOS",
        "prevSecret": secret(&first),
    });
    let (status, second) = from(&t, "POST", "/api/handoff/announce", None, Some(body), TV_IP).await;
    assert_eq!(status, StatusCode::OK);
    assert_ne!(second["handle"], first["handle"]);

    let (_, list) = from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, PHONE_IP).await;
    assert_eq!(list.as_array().map(Vec::len), Some(1));
    assert_eq!(poll_status(&t, &first).await, "expired");
}

#[tokio::test]
async fn an_unknown_secret_polls_expired() {
    let t = test_app();
    let (status, body) = get(&t.app, "/api/handoff/poll?secret=nope", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "expired");
    // Leaving with a secret nobody holds is a no-op, not an error.
    let (status, _) =
        send(&t.app, "POST", "/api/handoff/leave", None, Some(json!({ "secret": "nope" }))).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn listing_and_granting_need_a_session() {
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", TV_IP).await;

    let (status, _) = from(&t, "GET", "/api/handoff/devices", None, None, PHONE_IP).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, _) = from(
        &t,
        "POST",
        "/api/handoff/grant",
        None,
        Some(json!({ "handle": beacon["handle"] })),
        PHONE_IP,
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn two_waiting_tvs_are_listed_by_name() {
    let t = test_app();
    announce(&t, "tv-salon-01", "Salon", TV_IP).await;
    announce(&t, "tv-chambre-01", "Chambre", TV_IP).await;

    let (_, list) = from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, PHONE_IP).await;
    let names: Vec<&str> =
        list.as_array().expect("a list").iter().filter_map(|r| r["name"].as_str()).collect();
    assert_eq!(names, vec!["Chambre", "Salon"]);
}
