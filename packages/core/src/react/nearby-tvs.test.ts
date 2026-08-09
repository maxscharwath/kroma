// @vitest-environment jsdom
//
// The phone's picker as a hook: what it lists, what it does when a tap grants
// the account, and what it does when that tap arrives a moment too late.

import type { KromaClient } from '@kroma/client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiscoveredTv, LanService } from '../handoff';
import { beaconTxt } from '../handoff';
import { useNearbyTvs } from './nearby-tvs';

const SALON: DiscoveredTv = {
  handle: 'h-salon',
  name: 'Salon',
  platform: 'tvOS',
  check: 'K7QM',
  via: 'server',
};
const CHAMBRE: DiscoveredTv = {
  handle: 'h-chambre',
  name: 'Chambre',
  platform: 'Tizen',
  check: 'B4XR',
  via: 'server',
};

function stubClient(rows: DiscoveredTv[] = [SALON, CHAMBRE]) {
  return {
    handoffDevices: vi.fn(async () => rows),
    handoffGrant: vi.fn(async () => undefined),
  } as unknown as KromaClient;
}

// A phone that can hear its own link, publishing one television's record.
function stubLan(services: LanService[]) {
  return {
    browse(onFound: (found: LanService[]) => void) {
      onFound(services);
      return () => undefined;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('while the picker is open', () => {
  it('lists the TVs waiting on this network', async () => {
    const { result } = renderHook(() => useNearbyTvs({ client: stubClient() }));
    await waitFor(() => expect(result.current.devices).toHaveLength(2));
    // Sorted, not in the order a source happened to answer in: the list sits
    // under a thumb and must not reshuffle when the next poll lands.
    expect(result.current.devices.map((d) => d.name)).toEqual(['Chambre', 'Salon']);
    expect(result.current.connecting).toBeNull();
    expect(result.current.connected).toBeNull();
    expect(result.current.failed).toBe(false);
  });

  it('lists nothing at all without a session', () => {
    const { result } = renderHook(() => useNearbyTvs({ client: null }));
    expect(result.current.devices).toEqual([]);
  });
});

describe('a phone that can hear its own link', () => {
  it('merges what it heard with what the server listed, and prefers what it heard', async () => {
    const client = stubClient([SALON]);
    const lan = stubLan([
      {
        name: 'Salon',
        txt: beaconTxt({
          handle: 'h-salon',
          name: 'Salon',
          platform: 'tvOS',
          check: 'K7QM',
          proof: 'heard-it',
        }),
      },
    ]);
    const { result } = renderHook(() => useNearbyTvs({ client, lan }));
    await waitFor(() => expect(result.current.devices).toHaveLength(1));

    expect(result.current.devices[0]?.via).toBe('lan');
    expect(result.current.devices[0]?.proof).toBe('heard-it');
  });

  it('sends the proof it heard along with the grant', async () => {
    const client = stubClient([]);
    const lan = stubLan([
      {
        name: 'Salon',
        txt: beaconTxt({
          handle: 'h-salon',
          name: 'Salon',
          platform: 'tvOS',
          check: 'K7QM',
          proof: 'heard-it',
        }),
      },
    ]);
    const { result } = renderHook(() => useNearbyTvs({ client, lan }));
    await waitFor(() => expect(result.current.devices).toHaveLength(1));

    const heard = result.current.devices[0];
    if (!heard) throw new Error('expected the heard row');
    await act(async () => {
      await result.current.connect(heard);
    });
    expect(client.handoffGrant).toHaveBeenCalledWith('h-salon', 'heard-it');
  });
});

describe('tapping a TV', () => {
  it('grants that TV and drops its row, because it is no longer waiting', async () => {
    const client = stubClient();
    const { result } = renderHook(() => useNearbyTvs({ client }));
    await waitFor(() => expect(result.current.devices).toHaveLength(2));

    await act(async () => {
      await result.current.connect(SALON);
    });

    expect(client.handoffGrant).toHaveBeenCalledWith('h-salon', undefined);
    expect(result.current.connected).toEqual(SALON);
    expect(result.current.devices.map((d) => d.name)).toEqual(['Chambre']);
    expect(result.current.connecting).toBeNull();
    expect(result.current.failed).toBe(false);
  });

  it('says so when that TV stopped waiting, and keeps the list usable', async () => {
    const client = stubClient();
    vi.mocked(client.handoffGrant).mockRejectedValue(new Error('gone'));
    const { result } = renderHook(() => useNearbyTvs({ client }));
    await waitFor(() => expect(result.current.devices).toHaveLength(2));

    await act(async () => {
      await result.current.connect(SALON);
    });

    expect(result.current.failed).toBe(true);
    expect(result.current.connected).toBeNull();
    expect(result.current.connecting).toBeNull();
    // Nothing was dropped: the row is still there to try again, or to pick the
    // other TV instead.
    expect(result.current.devices).toHaveLength(2);
  });

  it('clears an earlier refusal when the next tap starts', async () => {
    const client = stubClient();
    vi.mocked(client.handoffGrant).mockRejectedValueOnce(new Error('gone'));
    const { result } = renderHook(() => useNearbyTvs({ client }));
    await waitFor(() => expect(result.current.devices).toHaveLength(2));

    await act(async () => {
      await result.current.connect(SALON);
    });
    expect(result.current.failed).toBe(true);

    await act(async () => {
      await result.current.connect(CHAMBRE);
    });
    expect(result.current.failed).toBe(false);
    expect(result.current.connected).toEqual(CHAMBRE);
  });

  it('does nothing without a session', async () => {
    const { result } = renderHook(() => useNearbyTvs({ client: null }));
    await act(async () => {
      await result.current.connect(SALON);
    });
    expect(result.current.connecting).toBeNull();
    expect(result.current.connected).toBeNull();
  });
});
