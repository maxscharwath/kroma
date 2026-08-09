//! `/api/handoff`: signing a TV in by pointing at it.
//!
//! A TV with no account announces itself; a phone already signed in lists the
//! TVs waiting on its own network and grants one its account. No code crosses
//! the room, so nothing has to be read off a screen or typed on a remote.
//!
//! What gates every route is the pair of addresses the two devices arrive from,
//! and nothing else. The server does not have to be on their network: it is a
//! rendezvous, so a TV and a phone in one room pair through a server anywhere in
//! the world. The service compares only their two addresses, which is why a TV
//! somewhere else never appears in a stranger's list and a handle learned some
//! other way cannot be granted from off-network.

use std::net::SocketAddr;

use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::api::accounts::mint_device_tokens;
use crate::api::error::lerr;
use crate::api::extract::AuthUser;
use crate::api::util::{client_ip, query, SecretQuery};
use crate::db;
use crate::i18n::ReqLocale;
use crate::services::pairing::handoff::{valid_device_id, Announce, Announcement, Nearby};
use crate::state::SharedState;

/// Reachable before a session exists: this is how a TV with no account at all
/// gets one.
pub fn public_routes() -> Router<SharedState> {
    Router::new()
        .route("/handoff/announce", post(announce))
        .route("/handoff/leave", post(leave))
        .route("/handoff/poll", get(poll))
}

/// The granting half: only a signed-in account can hand itself to a TV.
pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/handoff/devices", get(devices))
        .route("/handoff/grant", post(grant))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnounceBody {
    pub device_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub platform: String,
    /// The secret of the beacon this one replaces, so a TV re-announcing after a
    /// settings change does not leave its old row on anyone's phone.
    #[serde(default)]
    pub prev_secret: Option<String>,
}

/// `POST /api/handoff/announce` → what the TV needs to stay listed and to
/// collect the account it is granted.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnounceReply {
    pub handle: String,
    pub secret: String,
    /// Four characters the TV prints on its own screen so a person can tell two
    /// TVs apart in the phone's list. Never typed anywhere.
    pub check: String,
    /// Goes in the TV's DNS-SD record and nowhere else. A phone that can quote
    /// it heard this TV on the link, which is why the grant will take it in
    /// place of the address check.
    pub proof: String,
    pub ttl_secs: i64,
    /// How often to poll. Polling is what keeps the beacon listed, so a TV that
    /// stops polling leaves the list on its own.
    pub poll_secs: i64,
}

/// One waiting TV in `GET /api/handoff/devices`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NearbyDevice {
    pub handle: String,
    pub name: String,
    pub platform: String,
    pub check: String,
}

impl From<Nearby> for NearbyDevice {
    fn from(row: Nearby) -> Self {
        Self { handle: row.handle, name: row.name, platform: row.platform, check: row.check }
    }
}

#[derive(Debug, Deserialize)]
pub struct SecretBody {
    pub secret: String,
}

#[derive(Debug, Deserialize)]
pub struct GrantBody {
    pub handle: String,
    /// The beacon's `proof`, when the caller heard this TV on the link rather
    /// than being told about it by this server.
    #[serde(default)]
    pub proof: Option<String>,
}

// Tokens minted for a beacon nobody will collect. Deleting them is best-effort
// cleanup, never something a caller waits on the outcome of.
async fn drop_orphans(
    state: &SharedState,
    orphans: Vec<crate::services::pairing::Orphaned>,
) {
    for orphan in orphans {
        let token = orphan.token;
        let access = orphan.access_token;
        let _ = query(&state.db, move |pool| db::delete_session(&pool, &token)).await;
        let _ = query(&state.db, move |pool| db::delete_access_token(&pool, &access)).await;
    }
}

/// `POST /api/handoff/announce` → [`AnnounceReply`]. Unauthenticated by design:
/// the device announcing has no account yet. LAN-only, capped, and the reply's
/// `handle` is unguessable, so announcing reveals nothing to anyone who cannot
/// already list the subnet.
pub async fn announce(
    State(state): State<SharedState>,
    ReqLocale(loc): ReqLocale,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<AnnounceBody>,
) -> Response {
    let ip = client_ip(&headers, &addr);
    if !valid_device_id(&body.device_id) {
        return lerr(loc, StatusCode::BAD_REQUEST, "error.castBadReceiver");
    }

    if let Some(prev) = body.prev_secret.as_deref() {
        let orphan = state.handoff.forget(prev);
        drop_orphans(&state, orphan.into_iter().collect()).await;
    }

    let (announcement, mut orphans) = state.handoff.announce(Announce {
        device_id: body.device_id,
        name: body.name,
        platform: body.platform,
        ip,
    });
    orphans.extend(state.handoff.take_orphans());
    drop_orphans(&state, orphans).await;

    match announcement {
        Announcement::Ok(announced) => Json(AnnounceReply {
            handle: announced.handle,
            secret: announced.secret,
            check: announced.check,
            proof: announced.proof,
            ttl_secs: announced.ttl_secs,
            poll_secs: announced.poll_secs,
        })
        .into_response(),
        // This network is already holding as many waiting televisions as it may.
        // Refusing is the point: the slots belong to the devices that took them.
        Announcement::NetworkFull => {
            lerr(loc, StatusCode::TOO_MANY_REQUESTS, "handoff.tooManyHere")
        }
    }
}

/// `POST /api/handoff/leave` `{ secret }` → 204. Take the beacon down early
/// (the TV signed in another way, or is quitting) instead of waiting out its TTL.
pub async fn leave(State(state): State<SharedState>, Json(body): Json<SecretBody>) -> Response {
    let orphan = state.handoff.forget(&body.secret);
    drop_orphans(&state, orphan.into_iter().collect()).await;
    StatusCode::NO_CONTENT.into_response()
}

/// `GET /api/handoff/poll?secret=…` → `pending` | `authorized` (then the
/// session) | `expired`. Same shape as the Quick Connect poll, and it doubles as
/// the beacon's heartbeat: a TV that stops polling leaves the list.
pub async fn poll(State(state): State<SharedState>, Query(q): Query<SecretQuery>) -> Response {
    let status = super::dto::PairingPoll::from(state.handoff.poll(&q.secret));
    // Every poll is also the moment the store may have swept a lapsed beacon,
    // and a swept beacon that was approved still has real rows behind it.
    drop_orphans(&state, state.handoff.take_orphans()).await;
    Json(status).into_response()
}

/// `GET /api/handoff/devices` (Bearer) → the TVs waiting on the caller's own
/// network. Empty when none are, which is also the answer a caller sitting
/// somewhere else gets: being off-network is not worth a distinct error a
/// scanner could read.
pub async fn devices(
    State(state): State<SharedState>,
    AuthUser(_user): AuthUser,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Response {
    let ip = client_ip(&headers, &addr);
    let rows: Vec<NearbyDevice> =
        state.handoff.nearby(&ip).into_iter().map(NearbyDevice::from).collect();
    Json(rows).into_response()
}

/// `POST /api/handoff/grant` (Bearer) `{ handle }` → 204. Mints this account a
/// fresh device session and leaves it for the TV to collect on its next poll.
pub async fn grant(
    State(state): State<SharedState>,
    ReqLocale(loc): ReqLocale,
    AuthUser(user): AuthUser,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<GrantBody>,
) -> Response {
    let ip = client_ip(&headers, &addr);

    // The granting device is signed in and vouches for the TV, exactly as a
    // Quick Connect approval does. The TV is not the caller, so its user agent
    // is unknown here (NULL) until it first uses the token.
    let (token, access) = match mint_device_tokens(&state, &user.id, None).await {
        Ok(pair) => pair,
        Err(resp) => return resp,
    };

    let heard = body.proof.as_deref();
    if state.handoff.grant(&body.handle, &ip, heard, user, token.clone(), access.clone()) {
        StatusCode::NO_CONTENT.into_response()
    } else {
        // Unknown handle, lapsed beacon, or a caller that showed nothing
        // putting it beside that TV: one answer for all three. Don't leave the
        // just-minted tokens dangling.
        drop_orphans(
            &state,
            vec![crate::services::pairing::Orphaned { token, access_token: access }],
        )
        .await;
        lerr(loc, StatusCode::NOT_FOUND, "handoff.gone")
    }
}
