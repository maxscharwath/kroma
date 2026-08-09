// The two ways of finding a television, and the record that travels between
// them. What matters here: a record survives the round trip, a record this build
// does not understand is skipped rather than shown half-empty, and neither
// source blanks its list over one dropped answer.

import type { HandoffDevice, KromaClient } from '@kroma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beaconTxt, type LanService, lanSource, parseBeaconTxt, serverSource } from './sources';

const RECORD = {
  handle: 'a1b2c3',
  name: 'Salon',
  platform: 'tvOS',
  check: 'K7QM',
  proof: 'deadbeef',
};

function serverRows(n: number): HandoffDevice[] {
  return Array.from({ length: n }, (_, i) => ({
    handle: `h${i}`,
    name: `TV ${i}`,
    platform: 'tvOS',
    check: 'K7QM',
  }));
}

async function tick(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe('the published record', () => {
  it('survives the round trip', () => {
    expect(parseBeaconTxt(beaconTxt(RECORD))).toEqual(RECORD);
  });

  it('is refused when it is not a record this build understands', () => {
    // A future version, and one from before there were versions.
    expect(parseBeaconTxt({ ...beaconTxt(RECORD), v: '2' })).toBeNull();
    expect(parseBeaconTxt({ handle: 'a1b2c3', check: 'K7QM', proof: 'x' })).toBeNull();
  });

  it('is refused when it is missing what identifies or authorizes it', () => {
    for (const key of ['handle', 'check', 'proof']) {
      const txt = { ...beaconTxt(RECORD), [key]: '' };
      expect(parseBeaconTxt(txt), key).toBeNull();
    }
  });

  it('tolerates a television that said nothing about itself', () => {
    const txt = { ...beaconTxt(RECORD), name: '', platform: '' };
    expect(parseBeaconTxt(txt)).toEqual({ ...RECORD, name: '', platform: '' });
  });
});

describe('the server source', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lists what the server can see, and keeps looking', async () => {
    const handoffDevices = vi.fn(async () => serverRows(1));
    const client = { handoffDevices } as unknown as KromaClient;
    const seen: unknown[][] = [];
    const stop = serverSource(client).start((rows) => seen.push(rows));

    await tick();
    expect(seen[0]).toEqual([{ ...serverRows(1)[0], via: 'server' }]);

    handoffDevices.mockResolvedValue(serverRows(2));
    await tick(3000);
    expect(seen.at(-1)).toHaveLength(2);
    stop();
  });

  it('keeps the last good list when a poll does not answer, and recovers', async () => {
    const handoffDevices = vi.fn(async () => serverRows(1));
    const client = { handoffDevices } as unknown as KromaClient;
    const seen: unknown[][] = [];
    const stop = serverSource(client).start((rows) => seen.push(rows));
    await tick();

    handoffDevices.mockRejectedValue(new Error('offline'));
    await tick(3000);
    expect(seen).toHaveLength(1);

    handoffDevices.mockResolvedValue(serverRows(3));
    await tick(3000);
    expect(seen.at(-1)).toHaveLength(3);
    stop();
  });

  it('stops looking once the picker closes', async () => {
    const handoffDevices = vi.fn(async () => serverRows(1));
    const client = { handoffDevices } as unknown as KromaClient;
    const stop = serverSource(client).start(() => undefined);
    await tick();
    stop();

    await tick(30_000);
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
    const seen: unknown[][] = [];
    const stop = serverSource(client).start((rows) => seen.push(rows));

    stop();
    release?.(serverRows(1));
    await tick();
    expect(seen).toEqual([]);
  });

  it('schedules nothing more when a poll in flight fails after the close', async () => {
    let reject: ((cause: Error) => void) | undefined;
    const handoffDevices = vi.fn(
      () =>
        new Promise<HandoffDevice[]>((_resolve, r) => {
          reject = r;
        }),
    );
    const client = { handoffDevices } as unknown as KromaClient;
    const stop = serverSource(client).start(() => undefined);

    stop();
    reject?.(new Error('offline'));
    await tick(60_000);
    expect(handoffDevices).toHaveBeenCalledTimes(1);
  });
});

describe('the link source', () => {
  function bridgeWith(services: LanService[]) {
    let publish: ((found: LanService[]) => void) | undefined;
    const stop = vi.fn();
    const browse = vi.fn((onFound: (found: LanService[]) => void) => {
      publish = onFound;
      onFound(services);
      return stop;
    });
    return { bridge: { browse }, stop, push: (next: LanService[]) => publish?.(next) };
  }

  it('turns records it heard into rows that carry their proof', () => {
    const { bridge } = bridgeWith([{ name: 'Salon', txt: beaconTxt(RECORD) }]);
    const seen: unknown[][] = [];
    lanSource(bridge).start((rows) => seen.push(rows));

    expect(seen[0]).toEqual([
      {
        handle: 'a1b2c3',
        name: 'Salon',
        platform: 'tvOS',
        check: 'K7QM',
        via: 'lan',
        proof: 'deadbeef',
      },
    ]);
  });

  it('skips a record it cannot read rather than showing half of one', () => {
    const { bridge } = bridgeWith([
      { name: 'Salon', txt: beaconTxt(RECORD) },
      { name: 'Mystery', txt: { v: '99', handle: 'x' } },
      { name: 'Empty', txt: {} },
    ]);
    const seen: unknown[][] = [];
    lanSource(bridge).start((rows) => seen.push(rows));
    expect(seen[0]).toHaveLength(1);
  });

  it('falls back to the name the network published it under', () => {
    const { bridge } = bridgeWith([
      { name: 'Salon de Max', txt: { ...beaconTxt(RECORD), name: '' } },
    ]);
    const seen: Array<Array<{ name: string }>> = [];
    lanSource(bridge).start((rows) => seen.push(rows));
    expect(seen[0]?.[0]?.name).toBe('Salon de Max');
  });

  it('reports again every time the link changes', () => {
    const { bridge, push } = bridgeWith([]);
    const seen: unknown[][] = [];
    lanSource(bridge).start((rows) => seen.push(rows));
    push([{ name: 'Salon', txt: beaconTxt(RECORD) }]);

    expect(seen).toHaveLength(2);
    expect(seen[1]).toHaveLength(1);
  });

  it('hands the browse s stop back', () => {
    const { bridge, stop } = bridgeWith([]);
    lanSource(bridge).start(() => undefined)();
    expect(stop).toHaveBeenCalled();
  });

  it('is inert on a device that can publish but not browse', () => {
    const seen: unknown[][] = [];
    const stop = lanSource({ publish: () => () => undefined }).start((rows) => seen.push(rows));
    expect(seen).toEqual([]);
    expect(() => stop()).not.toThrow();
  });
});
