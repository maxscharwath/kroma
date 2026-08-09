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
// One household as a server on another network sees it: both devices leave
// through the same NAT, so both arrive wearing that one address.
const HOUSEHOLD: &str = "203.0.113.7";
const OTHER_HOUSEHOLD: &str = "203.0.113.9";

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
    // A POST with the secret in the body: a URL is written into every access
    // log the request passes through.
    let (status, body) = send(
        &t.app,
        "POST",
        "/api/handoff/poll",
        None,
        Some(json!({ "secret": secret(beacon) })),
    )
    .await;
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
async fn a_server_on_another_network_still_pairs_a_tv_and_a_phone_in_one_room() {
    // The server is somewhere else entirely (a NAS at home reached over a
    // tunnel, say), so it never sees either device's own address: the TV and
    // the phone both arrive through their household's one public address.
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", HOUSEHOLD).await;

    let (status, list) =
        from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, HOUSEHOLD).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(list.as_array().map(Vec::len), Some(1));

    let (status, _) = from(
        &t,
        "POST",
        "/api/handoff/grant",
        Some(&t.token),
        Some(json!({ "handle": list[0]["handle"] })),
        HOUSEHOLD,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(poll_status(&t, &beacon).await, "authorized");
}

#[tokio::test]
async fn a_phone_that_heard_the_tv_grants_where_the_addresses_alone_would_not() {
    // A home routed across two subnets, or a dual-stack one where the TV came
    // over IPv6 and the phone over IPv4: same room, addresses this server
    // cannot reconcile. Quoting the proof from the TV's DNS-SD record settles
    // it, because a multicast does not leave the link it was sent on.
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", TV_IP).await;
    let proof = beacon["proof"].as_str().expect("a link proof").to_string();
    assert_eq!(proof.len(), 32, "hex of 16 bytes");

    let refused = json!({ "handle": beacon["handle"] });
    let (status, _) =
        from(&t, "POST", "/api/handoff/grant", Some(&t.token), Some(refused), OTHER_SUBNET).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let heard = json!({ "handle": beacon["handle"], "proof": proof });
    let (status, _) =
        from(&t, "POST", "/api/handoff/grant", Some(&t.token), Some(heard), OTHER_SUBNET).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(poll_status(&t, &beacon).await, "authorized");
}

#[tokio::test]
async fn a_proof_nobody_published_is_refused() {
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", TV_IP).await;
    let before = session_count(&t).await;

    let invented = json!({ "handle": beacon["handle"], "proof": "0".repeat(32) });
    let (status, _) =
        from(&t, "POST", "/api/handoff/grant", Some(&t.token), Some(invented), OTHER_SUBNET).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(poll_status(&t, &beacon).await, "pending");
    assert_eq!(session_count(&t).await, before);
}

#[tokio::test]
async fn a_phone_leaving_through_another_router_is_shown_no_tvs_and_may_not_grant() {
    // Next door, or the same phone with wifi off: a different way onto the
    // internet, so not the same room however close it is.
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", HOUSEHOLD).await;
    let handle = beacon["handle"].clone();

    // Not an error a scanner could read: the same empty list as "nothing waiting".
    let (status, list) =
        from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, OTHER_HOUSEHOLD).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(list.as_array().map(Vec::len), Some(0));

    let before = session_count(&t).await;
    let (status, _) = from(
        &t,
        "POST",
        "/api/handoff/grant",
        Some(&t.token),
        Some(json!({ "handle": handle })),
        OTHER_HOUSEHOLD,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
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
async fn a_caller_cannot_claim_a_subnet_by_writing_it_into_the_forwarded_header() {
    // The shape a proxy produces is `what-the-caller-sent, the-peer-it-saw`, so
    // believing the left half is how a stranger claims to be in your house.
    let t = test_app();
    announce(&t, "tv-salon-01", "Salon", TV_IP).await;

    let (status, list) = from(
        &t,
        "GET",
        "/api/handoff/devices",
        Some(&t.token),
        None,
        // Claiming the television's own subnet, from somewhere else entirely.
        "192.168.1.50, 203.0.113.9",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(list.as_array().map(Vec::len), Some(0), "the claim was believed");
}

#[tokio::test]
async fn a_beacon_already_granted_is_neither_listed_nor_grantable_again() {
    let t = test_app();
    let beacon = announce(&t, "tv-salon-01", "Salon", TV_IP).await;
    let grant = json!({ "handle": beacon["handle"] });

    let (status, _) =
        from(&t, "POST", "/api/handoff/grant", Some(&t.token), Some(grant.clone()), PHONE_IP).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    // Gone from the list before the television has even collected it.
    let (_, list) = from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, PHONE_IP).await;
    assert_eq!(list.as_array().map(Vec::len), Some(0));

    // And a second grant mints nothing: the first approver's session stands.
    let before = session_count(&t).await;
    let (status, _) =
        from(&t, "POST", "/api/handoff/grant", Some(&t.token), Some(grant), PHONE_IP).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(session_count(&t).await, before, "a refused second grant minted a session");

    assert_eq!(poll_status(&t, &beacon).await, "authorized");
}

#[tokio::test]
async fn a_network_already_holding_its_share_is_refused_rather_than_thinned() {
    let t = test_app();
    let first = announce(&t, "tv-0000-xxxx", "Salon", TV_IP).await;
    for i in 1..8 {
        announce(&t, &format!("tv-{i:04}-xxxx"), "Flood", TV_IP).await;
    }

    let body = json!({ "deviceId": "tv-late-xxxx", "name": "Late", "platform": "tvOS" });
    let (status, _) = from(&t, "POST", "/api/handoff/announce", None, Some(body), TV_IP).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);

    // Nobody was pushed out to make room.
    assert_eq!(poll_status(&t, &first).await, "pending");
    let (_, list) = from(&t, "GET", "/api/handoff/devices", Some(&t.token), None, PHONE_IP).await;
    assert_eq!(list.as_array().map(Vec::len), Some(8));
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
    let (status, body) =
        send(&t.app, "POST", "/api/handoff/poll", None, Some(json!({ "secret": "nope" }))).await;
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
