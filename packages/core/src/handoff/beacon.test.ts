// The television's loop, driven on fake timers against a stub client. What it
// has to do: publish and wait, sign in on a grant, start over when the beacon
// lapses, stay quiet when the server refuses, and keep its DNS-SD record in
// step with whichever beacon is current.

import type { KromaClient, PairingStatus, User } from '@kroma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type HandoffBeaconView, startHandoff } from './beacon';

const USER = { id: 'u1', username: 'owner' } as unknown as User;

const BEACON = {
  handle: 'h1',
  secret: 's1',
  check: 'K7QM',
  proof: 'p1',
  instanceId: 'srv-1',
  ttlSecs: 60,
  pollSecs: 3,
};

function stubClient(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: string[] = [];
  const announces: Array<{ deviceId: string; name: string; prevSecret?: string }> = [];
  const left: string[] = [];
  let minted = 0;
  const client = {
    announceHandoff: vi.fn(
      async (body: { deviceId: string; name: string; prevSecret?: string }) => {
        calls.push('announce');
        announces.push(body);
        minted += 1;
        return { ...BEACON, secret: `s${minted}`, handle: `h${minted}`, proof: `p${minted}` };
      },
    ),
    handoffPoll: vi.fn(async (): Promise<PairingStatus> => {
      calls.push('poll');
      return { status: 'pending' };
    }),
    handoffLeave: vi.fn(async (secret: string) => {
      calls.push('leave');
      left.push(secret);
    }),
    ...overrides,
  } as unknown as KromaClient;
  return { client, calls, announces, left };
}

function run(client: KromaClient) {
  const beacons: Array<HandoffBeaconView | null> = [];
  const signedIn: Array<{ token: string }> = [];
  const stop = startHandoff({
    client,
    deviceId: 'tv-salon-01',
    name: 'Apple TV',
    platform: 'Apple TV',
    onBeacon: (b) => beacons.push(b),
    onAuthenticated: (r) => signedIn.push({ token: r.token }),
  });
  return { stop, beacons, signedIn };
}

// Let every already-resolved promise settle, then advance to the next timer.
async function tick(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('publishing the beacon', () => {
  it('announces this TV and shows what the phone will see', async () => {
    const { client, announces } = stubClient();
    const { beacons, stop } = run(client);
    await tick();

    expect(announces[0]).toEqual({
      deviceId: 'tv-salon-01',
      name: 'Apple TV',
      platform: 'Apple TV',
    });
    expect(beacons.at(-1)).toEqual({ name: 'Apple TV', check: 'K7QM' });
    stop();
  });

  it('polls on the cadence the server asked for, and not before', async () => {
    const { client } = stubClient();
    const { stop } = run(client);
    await tick();
    expect(client.handoffPoll).not.toHaveBeenCalled();

    await tick(3000);
    expect(client.handoffPoll).toHaveBeenCalledTimes(1);
    await tick(3000);
    expect(client.handoffPoll).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('publishing on this television s own link', () => {
  it('puts the beacon on the link as well as at the server', async () => {
    const published: Array<{ name: string; txt: Record<string, string> }> = [];
    const unpublish = vi.fn();
    const { client } = stubClient();
    const stop = startHandoff({
      client,
      deviceId: 'tv-salon-01',
      name: 'Apple TV',
      platform: 'Apple TV',
      publish: (service) => {
        published.push(service);
        return unpublish;
      },
      onBeacon: () => undefined,
      onAuthenticated: () => undefined,
    });
    await tick();

    expect(published).toHaveLength(1);
    expect(published[0]?.name).toBe('Apple TV');
    // The record carries what a phone needs to name the row and to prove it
    // heard this television.
    expect(published[0]?.txt.handle).toBe('h1');
    expect(published[0]?.txt.proof).toBe('p1');
    // Which install minted the handle, so a phone on another server can tell.
    expect(published[0]?.txt.server).toBe('srv-1');
    expect(published[0]?.txt.check).toBe('K7QM');

    stop();
    expect(unpublish).toHaveBeenCalled();
  });

  it('replaces the record when the beacon rotates, so no stale handle stays audible', async () => {
    const published: Array<{ txt: Record<string, string> }> = [];
    const unpublish = vi.fn();
    const { client } = stubClient({
      handoffPoll: vi.fn(async (): Promise<PairingStatus> => ({ status: 'expired' })),
    });
    const stop = startHandoff({
      client,
      deviceId: 'tv-salon-01',
      name: 'Apple TV',
      platform: 'Apple TV',
      publish: (service) => {
        published.push(service);
        return unpublish;
      },
      onBeacon: () => undefined,
      onAuthenticated: () => undefined,
    });
    await tick();
    await tick(3000);

    expect(published.map((p) => p.txt.handle)).toEqual(['h1', 'h2']);
    expect(unpublish).toHaveBeenCalledTimes(1);
    stop();
  });

  it('keeps the record up across polls, rather than taking it down after one', async () => {
    // The record is the whole point of publishing: a beacon that is announced
    // and then goes silent on the link is worse than one never published, since
    // the phone saw it once and will not see it go.
    const published: unknown[] = [];
    const unpublish = vi.fn();
    const { client } = stubClient();
    const stop = startHandoff({
      client,
      deviceId: 'tv-salon-01',
      name: 'Apple TV',
      platform: 'Apple TV',
      publish: (service) => {
        published.push(service);
        return unpublish;
      },
      onBeacon: () => undefined,
      onAuthenticated: () => undefined,
    });

    await tick();
    expect(published).toHaveLength(1);

    // Several polls, all pending.
    for (let i = 0; i < 4; i++) await tick(3000);
    expect(client.handoffPoll).toHaveBeenCalledTimes(4);
    expect(unpublish, 'the record was taken down while still waiting').not.toHaveBeenCalled();
    expect(published, 'the record was republished for no reason').toHaveLength(1);

    stop();
  });

  it('publishes under the brand when the television has no name of its own', async () => {
    const published: Array<{ name: string }> = [];
    const { client } = stubClient();
    const stop = startHandoff({
      client,
      deviceId: 'tv-salon-01',
      name: '',
      platform: '',
      publish: (service) => {
        published.push(service);
        return () => undefined;
      },
      onBeacon: () => undefined,
      onAuthenticated: () => undefined,
    });
    await tick();
    // A DNS-SD record needs an instance name, and an empty one is not a name.
    expect(published[0]?.name).toBe('KROMA');
    stop();
  });

  it('still pairs through the server when the platform refuses to publish', async () => {
    const publish = vi.fn(() => {
      throw new Error('no local network permission');
    });
    const { client } = stubClient();
    const beacons: Array<HandoffBeaconView | null> = [];
    const stop = startHandoff({
      client,
      deviceId: 'tv-salon-01',
      name: 'Apple TV',
      platform: 'Apple TV',
      publish,
      onBeacon: (b) => beacons.push(b),
      onAuthenticated: () => undefined,
    });
    await tick();

    expect(publish).toHaveBeenCalled();
    // The screen still shows the beacon: the server half worked.
    expect(beacons.at(-1)).toEqual({ name: 'Apple TV', check: 'K7QM' });
    expect(() => stop()).not.toThrow();
  });
});

describe('a phone granting the account', () => {
  it('signs in with what the poll handed back, and stops', async () => {
    const authorized: PairingStatus = {
      status: 'authorized',
      token: 'tok',
      accessToken: 'acc',
      user: USER,
    };
    const { client } = stubClient({
      handoffPoll: vi.fn(async () => authorized),
    });
    const { beacons, signedIn, stop } = run(client);
    await tick();
    await tick(3000);

    expect(signedIn).toEqual([{ token: 'tok' }]);
    // The beacon was consumed server-side, so nothing is taken down.
    expect(beacons.at(-1)).toBeNull();
    expect(client.handoffLeave).not.toHaveBeenCalled();

    // And the loop is done: no further polling.
    await tick(30_000);
    expect(client.handoffPoll).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('a beacon that lapsed', () => {
  it('announces a fresh one, retiring the old secret in the same call', async () => {
    const { client, announces } = stubClient({
      handoffPoll: vi.fn(async (): Promise<PairingStatus> => ({ status: 'expired' })),
    });
    const { stop } = run(client);
    await tick();
    await tick(3000);

    expect(announces).toHaveLength(2);
    expect(announces[1]?.prevSecret).toBe('s1');
    stop();
  });
});

describe('a poll that did not answer', () => {
  it('keeps the beacon and tries again rather than re-announcing', async () => {
    const { client, announces } = stubClient({
      handoffPoll: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const { stop } = run(client);
    await tick();
    await tick(3000);
    await tick(3000);

    expect(announces).toHaveLength(1);
    expect(client.handoffPoll).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('a server that refuses to publish a beacon', () => {
  it('shows nothing and retries slowly, leaving the code path alone', async () => {
    const announce = vi.fn(async () => {
      throw new Error('not on the local network');
    });
    const { client } = stubClient({ announceHandoff: announce });
    const { beacons, stop } = run(client);
    await tick();

    expect(beacons.at(-1)).toBeNull();
    expect(client.handoffPoll).not.toHaveBeenCalled();

    await tick(15_000);
    expect(announce).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('stopping', () => {
  it('takes the beacon down instead of leaving it on every phone', async () => {
    const { client, left } = stubClient();
    const { beacons, stop } = run(client);
    await tick();

    stop();
    expect(left).toEqual(['s1']);
    expect(beacons.at(-1)).toBeNull();

    // Nothing is in flight afterwards, however long the caller waits.
    await tick(60_000);
    expect(client.announceHandoff).toHaveBeenCalledTimes(1);
    expect(client.handoffPoll).not.toHaveBeenCalled();
  });

  it('takes down a beacon the server minted after the stop', async () => {
    // The television signed in another way while the announce was in flight.
    // Discarding the reply would leave a row in every nearby picker for the
    // full TTL, offering a grant nothing will ever collect.
    const { client, left } = stubClient();
    const { stop } = run(client);
    stop();
    await tick();

    expect(left).toEqual(['s1']);
    expect(client.handoffPoll).not.toHaveBeenCalled();
  });

  it('schedules nothing more when a poll in flight fails after the stop', async () => {
    let reject: ((cause: Error) => void) | undefined;
    const handoffPoll = vi.fn(
      () =>
        new Promise<PairingStatus>((_resolve, r) => {
          reject = r;
        }),
    );
    const { client } = stubClient({ handoffPoll });
    const { stop } = run(client);
    await tick();
    await tick(3000);

    stop();
    reject?.(new Error('offline'));
    await tick();

    // The retry the failed poll would have queued was never armed.
    await tick(60_000);
    expect(handoffPoll).toHaveBeenCalledTimes(1);
  });

  it('does not sign in on a grant that lands after the stop', async () => {
    let resolve: ((status: PairingStatus) => void) | undefined;
    const { client } = stubClient({
      handoffPoll: vi.fn(
        () =>
          new Promise<PairingStatus>((r) => {
            resolve = r;
          }),
      ),
    });
    const { signedIn, stop } = run(client);
    await tick();
    await tick(3000);

    stop();
    resolve?.({ status: 'authorized', token: 'tok', accessToken: 'acc', user: USER });
    await tick();
    expect(signedIn).toEqual([]);
  });

  it('shows no beacon for an announce that fails after the stop', async () => {
    let reject: ((cause: Error) => void) | undefined;
    const { client } = stubClient({
      announceHandoff: vi.fn(
        () =>
          new Promise((_resolve, r) => {
            reject = r;
          }),
      ),
    });
    const { beacons, stop } = run(client);

    stop();
    const before = beacons.length;
    reject?.(new Error('refused'));
    await tick();

    // The stop already published the empty state; the late failure adds nothing.
    expect(beacons).toHaveLength(before);
    await tick(60_000);
    expect(client.announceHandoff).toHaveBeenCalledTimes(1);
  });

  it('survives a leave the server refuses', async () => {
    const { client } = stubClient({
      handoffLeave: vi.fn(async () => {
        throw new Error('gone');
      }),
    });
    const { stop } = run(client);
    await tick();
    expect(() => stop()).not.toThrow();
    await tick();
  });
});
