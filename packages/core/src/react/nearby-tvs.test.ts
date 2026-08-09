// @vitest-environment jsdom
//
// The phone's picker as a hook: what it lists, what it does when a tap grants
// the account, and what it does when that tap arrives a moment too late.

import type { HandoffDevice, KromaClient } from '@kroma/client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNearbyTvs } from './nearby-tvs';

const SALON: HandoffDevice = {
  handle: 'h-salon',
  name: 'Salon',
  platform: 'tvOS',
  check: 'K7QM',
};
const CHAMBRE: HandoffDevice = {
  handle: 'h-chambre',
  name: 'Chambre',
  platform: 'Tizen',
  check: 'B4XR',
};

function stubClient(rows: HandoffDevice[] = [SALON, CHAMBRE]) {
  return {
    handoffDevices: vi.fn(async () => rows),
    handoffGrant: vi.fn(async () => undefined),
  } as unknown as KromaClient;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('while the picker is open', () => {
  it('lists the TVs waiting on this network', async () => {
    const { result } = renderHook(() => useNearbyTvs(stubClient()));
    await waitFor(() => expect(result.current.devices).toHaveLength(2));
    expect(result.current.devices.map((d) => d.name)).toEqual(['Salon', 'Chambre']);
    expect(result.current.connecting).toBeNull();
    expect(result.current.connected).toBeNull();
    expect(result.current.failed).toBe(false);
  });

  it('lists nothing at all without a session', () => {
    const { result } = renderHook(() => useNearbyTvs(null));
    expect(result.current.devices).toEqual([]);
  });
});

describe('tapping a TV', () => {
  it('grants that TV and drops its row, because it is no longer waiting', async () => {
    const client = stubClient();
    const { result } = renderHook(() => useNearbyTvs(client));
    await waitFor(() => expect(result.current.devices).toHaveLength(2));

    await act(async () => {
      await result.current.connect(SALON);
    });

    expect(client.handoffGrant).toHaveBeenCalledWith('h-salon');
    expect(result.current.connected).toEqual(SALON);
    expect(result.current.devices.map((d) => d.name)).toEqual(['Chambre']);
    expect(result.current.connecting).toBeNull();
    expect(result.current.failed).toBe(false);
  });

  it('says so when that TV stopped waiting, and keeps the list usable', async () => {
    const client = stubClient();
    vi.mocked(client.handoffGrant).mockRejectedValue(new Error('gone'));
    const { result } = renderHook(() => useNearbyTvs(client));
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
    const { result } = renderHook(() => useNearbyTvs(client));
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
    const { result } = renderHook(() => useNearbyTvs(null));
    await act(async () => {
      await result.current.connect(SALON);
    });
    expect(result.current.connecting).toBeNull();
    expect(result.current.connected).toBeNull();
  });
});
