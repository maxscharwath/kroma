// Both handoff loops, driven on fake timers against a stub client. What the TV
// side has to do: publish and wait, sign in on a grant, start over when the
// beacon lapses, stay quiet when the server refuses. What the phone side has to
// do: keep the list fresh, and never blank it over one dropped request.

import type { HandoffDevice, KromaClient, PairingStatus, User } from '@kroma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type HandoffBeaconView, startHandoff, watchNearbyTvs } from './handoff';

const USER = { id: 'u1', username: 'owner' } as unknown as User;

const BEACON = { handle: 'h1', secret: 's1', check: 'K7QM', ttlSecs: 60, pollSecs: 3 };

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
        return { ...BEACON, secret: `s${minted}`, handle: `h${minted}` };
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

  it('has nothing to take down before the first announce lands', async () => {
    const { client, left } = stubClient();
    const { stop } = run(client);
    stop();
    await tick();
    expect(left).toEqual([]);
    // The announce that was already in flight is discarded, not acted on.
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

describe('watching for nearby TVs', () => {
  function rows(n: number): HandoffDevice[] {
    return Array.from({ length: n }, (_, i) => ({
      handle: `h${i}`,
      name: `TV ${i}`,
      platform: 'tvOS',
      check: 'K7QM',
    }));
  }

  it('lists what is waiting and keeps looking', async () => {
    const handoffDevices = vi.fn(async () => rows(1));
    const client = { handoffDevices } as unknown as KromaClient;
    const seen: HandoffDevice[][] = [];
    const stop = watchNearbyTvs({ client, onRows: (r) => seen.push(r) });

    await tick();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.[0]?.name).toBe('TV 0');

    handoffDevices.mockResolvedValue(rows(2));
    await tick(3000);
    expect(seen.at(-1)).toHaveLength(2);
    stop();
  });

  it('keeps the last good list when a poll does not answer', async () => {
    const handoffDevices = vi.fn(async () => rows(1));
    const client = { handoffDevices } as unknown as KromaClient;
    const seen: HandoffDevice[][] = [];
    const stop = watchNearbyTvs({ client, onRows: (r) => seen.push(r) });
    await tick();

    handoffDevices.mockRejectedValue(new Error('offline'));
    await tick(3000);
    // Nothing new was published: the row on screen is stale, not gone.
    expect(seen).toHaveLength(1);

    // And it recovers on the next tick rather than giving up.
    handoffDevices.mockResolvedValue(rows(3));
    await tick(3000);
    expect(seen.at(-1)).toHaveLength(3);
    stop();
  });

  it('stops looking once the picker closes', async () => {
    const handoffDevices = vi.fn(async () => rows(1));
    const client = { handoffDevices } as unknown as KromaClient;
    const seen: HandoffDevice[][] = [];
    const stop = watchNearbyTvs({ client, onRows: (r) => seen.push(r) });
    await tick();
    stop();

    await tick(30_000);
    expect(handoffDevices).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
  });

  it('schedules nothing more when a poll in flight fails after the picker closed', async () => {
    let reject: ((cause: Error) => void) | undefined;
    const handoffDevices = vi.fn(
      () =>
        new Promise<HandoffDevice[]>((_resolve, r) => {
          reject = r;
        }),
    );
    const client = { handoffDevices } as unknown as KromaClient;
    const stop = watchNearbyTvs({ client, onRows: () => undefined });

    stop();
    reject?.(new Error('offline'));
    await tick();

    await tick(60_000);
    expect(handoffDevices).toHaveBeenCalledTimes(1);
  });

  it('publishes nothing from a poll that landed after the picker closed', async () => {
    let release: ((rows: HandoffDevice[]) => void) | undefined;
    const handoffDevices = vi.fn(
      () =>
        new Promise<HandoffDevice[]>((resolve) => {
          release = resolve;
        }),
    );
    const client = { handoffDevices } as unknown as KromaClient;
    const seen: HandoffDevice[][] = [];
    const stop = watchNearbyTvs({ client, onRows: (r) => seen.push(r) });

    stop();
    release?.(rows(1));
    await tick();
    expect(seen).toEqual([]);
  });
});
