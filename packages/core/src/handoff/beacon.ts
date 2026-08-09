// The TV's half of the nearby handoff: publish a beacon while signed out, poll
// it, and sign in the moment a phone next to it grants an account.
//
// The beacon goes up in two places at once where the platform allows it: at the
// server, which any phone can list, and on the link itself as a DNS-SD record,
// which only a phone in the same room can hear. The second is optional and the
// first is not, because the grant travels through the server either way.
//
// Kept out of React on purpose. This is a loop with several ways to go wrong
// (the server does not answer, the beacon lapses, the grant arrives, the screen
// goes away), and every one of them is worth a test that needs no renderer.

import type { AuthResult, KromaClient } from '@kroma/client';
import { beaconTxt, type LanDiscoveryBridge } from './sources';

/** What the gate screens show while the TV waits: the name a phone sees, and
 * the check string that says which row in that list is this TV. */
export interface HandoffBeaconView {
  name: string;
  check: string;
}

export interface HandoffLoopOptions {
  client: KromaClient;
  deviceId: string;
  /** Publish the beacon on this device's own link as well, when the platform
   * has a DNS-SD stack to publish it with. A phone that hears the record has
   * proved it is in the room, which is worth more than any address the server
   * can infer, so this is what makes handoff work across a routed home or a
   * dual-stack one. Absent on a shell that cannot publish. */
  publish?: LanDiscoveryBridge['publish'];
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
  const { client, deviceId, name, platform, publish, onBeacon, onAuthenticated } = opts;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let secret = '';
  let unpublish: (() => void) | undefined;

  // Every beacon gets its own record, so a rotated one never leaves a stale
  // handle audible on the link. A device has only one record: this is the
  // signed-OUT one, and the cast receiver publishes the signed-in one. The two
  // never overlap (see CastReceiverProvider).
  const republish = (record: Parameters<typeof beaconTxt>[0] | null) => {
    unpublish?.();
    unpublish = undefined;
    if (!record || !publish) return;
    try {
      unpublish = publish({ name: record.name || 'KROMA', txt: beaconTxt(record) });
    } catch {
      // A platform that refuses to publish (no permission, no multicast) still
      // pairs through the server.
    }
  };

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
        republish(null);
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
      if (stopped) {
        // The loop was stopped while this announce was in flight: the television
        // signed in some other way, or the screen went. The server minted a
        // beacon nobody now holds, and leaving it would keep a row in every
        // nearby picker for its full TTL, offering a grant the television will
        // never collect. Take it down.
        client.handoffLeave(beacon.secret).catch(() => undefined);
        return;
      }
      secret = beacon.secret;
      republish({
        state: 'waiting',
        handle: beacon.handle,
        name,
        platform,
        // Which install minted the handle: a phone whose server is a different
        // one cannot grant it, and should not be shown a row it can only fail
        // to use.
        server: beacon.instanceId,
        check: beacon.check,
        proof: beacon.proof,
      });
      onBeacon({ name, check: beacon.check });
      wait(beacon.pollSecs * 1000, () => void poll(beacon.pollSecs * 1000));
    } catch {
      // Refused (not on the local network) or unavailable (an older server).
      // Either way the code + QR on screen still pair this TV.
      if (stopped) return;
      secret = '';
      republish(null);
      onBeacon(null);
      wait(RETRY_MS, () => void begin());
    }
  };

  void begin();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
    republish(null);
    onBeacon(null);
    if (secret) {
      const going = secret;
      secret = '';
      client.handoffLeave(going).catch(() => undefined);
    }
  };
}
