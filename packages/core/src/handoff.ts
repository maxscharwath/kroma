// Nearby handoff, both halves, headless.
//
// `startHandoff` is what a TV runs while it is signed out: publish a beacon,
// poll it, and sign in the moment a phone on the same network grants it an
// account. `watchNearbyTvs` is what that phone runs: keep the list of TVs
// waiting on this network fresh while the picker is open.
//
// Kept out of React on purpose. Each is a loop with several ways to go wrong
// (the server does not answer, the beacon lapses, the grant arrives, the screen
// goes away), and every one of them is worth a test that needs no renderer.

import type { AuthResult, HandoffDevice, KromaClient } from '@kroma/client';

/** What the gate screens show while the TV waits: the name a phone sees, and
 * the check string that says which row in that list is this TV. */
export interface HandoffBeaconView {
  name: string;
  check: string;
}

export interface HandoffLoopOptions {
  client: KromaClient;
  deviceId: string;
  /** What this TV calls itself in the phone's list. */
  name: string;
  platform: string;
  /** The beacon to show, or null while there is none: announcing, or refused
   * because the TV is off the local network or the server has no handoff. */
  onBeacon: (beacon: HandoffBeaconView | null) => void;
  onAuthenticated: (result: AuthResult) => void;
}

// How long to wait before announcing again after the server refused or did not
// answer. Long enough not to hammer a server that has no handoff at all.
const RETRY_MS = 15_000;

/**
 * Start announcing this TV and watching for a grant. Returns the stop function:
 * call it when the TV signs in or the screen goes away, and the beacon comes
 * down instead of lingering on someone's phone until its TTL.
 */
export function startHandoff(opts: HandoffLoopOptions): () => void {
  const { client, deviceId, name, platform, onBeacon, onAuthenticated } = opts;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let secret = '';

  // The one place a next step is scheduled, and so the one place that has to
  // notice the loop was stopped while a request was in flight.
  const wait = (ms: number, run: () => void) => {
    if (stopped) return;
    timer = setTimeout(run, ms);
  };

  const poll = async (every: number) => {
    try {
      const status = await client.handoffPoll(secret);
      if (stopped) return;
      if (status.status === 'authorized') {
        // Collected: the beacon is already consumed server-side, so there is
        // nothing left to take down.
        secret = '';
        onBeacon(null);
        onAuthenticated({
          token: status.token,
          accessToken: status.accessToken,
          user: status.user,
        });
        return;
      }
      if (status.status === 'expired') {
        void begin();
        return;
      }
    } catch {
      // A dropped poll is not a lapsed beacon: keep the current one and retry.
    }
    wait(every, () => void poll(every));
  };

  const begin = async () => {
    try {
      // Passing the outgoing secret retires that beacon up front, so a phone
      // looking at the list never sees this TV twice.
      const beacon = await client.announceHandoff({
        deviceId,
        name,
        platform,
        ...(secret ? { prevSecret: secret } : {}),
      });
      if (stopped) return;
      secret = beacon.secret;
      onBeacon({ name, check: beacon.check });
      wait(beacon.pollSecs * 1000, () => void poll(beacon.pollSecs * 1000));
    } catch {
      // Refused (not on the local network) or unavailable (an older server).
      // Either way the code + QR on screen still pair this TV.
      if (stopped) return;
      secret = '';
      onBeacon(null);
      wait(RETRY_MS, () => void begin());
    }
  };

  void begin();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
    onBeacon(null);
    if (secret) {
      const going = secret;
      secret = '';
      client.handoffLeave(going).catch(() => undefined);
    }
  };
}

export interface NearbyWatchOptions {
  client: KromaClient;
  /** The TVs waiting on this device's own network. Empty when none are, and
   * empty off the local network too: the server does not distinguish between
   * those two, so neither does this. */
  onRows: (rows: HandoffDevice[]) => void;
}

// The picker is open on a phone in someone's hand: fast enough that a TV
// switched on while they look appears without them thinking to refresh.
const NEARBY_POLL_MS = 3000;

/**
 * Keep the nearby-TV list fresh for as long as the picker is open. Returns the
 * stop function.
 *
 * A failed poll leaves the last good list on screen rather than blanking it: a
 * dropped request is not the same as the TVs going away, and a list that
 * flickers empty under someone's thumb is worse than one a few seconds stale.
 */
export function watchNearbyTvs(opts: NearbyWatchOptions): () => void {
  const { client, onRows } = opts;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // As in `startHandoff`: the one place a next step is scheduled is the one
  // place that has to notice the picker closed mid-request.
  const wait = () => {
    if (stopped) return;
    timer = setTimeout(() => void tick(), NEARBY_POLL_MS);
  };

  const tick = async () => {
    try {
      const rows = await client.handoffDevices();
      if (!stopped) onRows(rows);
    } catch {
      /* keep the last good list */
    }
    wait();
  };

  void tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
}
