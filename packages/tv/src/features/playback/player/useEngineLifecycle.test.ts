// @vitest-environment jsdom
import type { KromaClient, MediaItem } from '@kroma/core';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ stalled: false }));

vi.mock('#tv/features/playback/player/useStallGuard', () => ({
  useStallGuard: () => H.stalled,
}));

vi.mock('#tv/features/playback/player/backend', () => ({
  planEngine: () => ({
    eng: 'video',
    surface: 'video',
    playbackMode: 'direct',
    deviceLabel: 'a television',
    rebuildKey: 'video:true',
  }),
  createTvEngine: () => null,
}));

vi.mock('#tv/features/playback/player/useResolvedStart', () => ({
  useResolvedStart: () => ({ startSec: null, setStartSec: vi.fn() }),
}));

vi.mock('#tv/features/playback/player/vlcPlane', () => ({ vlcAvailable: () => false }));

const { useEngineLifecycle } = await import('#tv/features/playback/player/useEngineLifecycle');

const CLIENT = { hasAuth: false } as unknown as KromaClient;
const ITEM = { id: 'vid1', durationMs: 7_200_000 } as unknown as MediaItem;

describe('useEngineLifecycle stall guard', () => {
  it('shows a stuck playhead as buffering rather than as a healthy bar', async () => {
    H.stalled = true;

    const { result } = renderHook(() => useEngineLifecycle(CLIENT, ITEM));

    await waitFor(() => expect(result.current.waiting).toBe(true));
  });

  it('leaves the buffering flag to the engine while nothing is stuck', async () => {
    H.stalled = false;

    const { result } = renderHook(() => useEngineLifecycle(CLIENT, ITEM));

    await waitFor(() => expect(result.current.ready).toBe(false));
    expect(result.current.playing).toBe(false);
  });
});
