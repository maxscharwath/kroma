// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SeekDeps, useSeekGesture } from './useSeekGesture';

function gesture(over: Partial<SeekDeps> = {}) {
  const seekTo = over.seekTo ?? vi.fn();
  const deps: SeekDeps = {
    getPosition: () => 100,
    duration: () => 1000,
    seekTo,
    ...over,
  };
  const view = renderHook(() => useSeekGesture(deps));
  return { ...view, seekTo: seekTo as ReturnType<typeof vi.fn> };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useSeekGesture taps', () => {
  it('a single tap previews +5s and commits exactly one seek after the idle window', () => {
    const { result, seekTo } = gesture();
    act(() => result.current.tap(1));
    expect(result.current.preview).toBe(105);
    expect(seekTo).not.toHaveBeenCalled(); // still settling
    act(() => vi.advanceTimersByTime(450));
    expect(seekTo).toHaveBeenCalledTimes(1);
    expect(seekTo).toHaveBeenCalledWith(105);
    expect(result.current.preview).toBeNull();
  });

  it('quick successive taps STACK into one preview and one seek', () => {
    const { result, seekTo } = gesture();
    act(() => result.current.tap(1));
    act(() => result.current.tap(1)); // stacks off the pending 105
    expect(result.current.preview).toBe(110);
    act(() => vi.advanceTimersByTime(450));
    expect(seekTo).toHaveBeenCalledTimes(1);
    expect(seekTo).toHaveBeenCalledWith(110);
  });

  it('clamps a backward tap to 0 and a forward tap to duration-1', () => {
    const back = gesture({ getPosition: () => 2, duration: () => 1000 });
    act(() => back.result.current.tap(-1));
    expect(back.result.current.preview).toBe(0);

    const fwd = gesture({ getPosition: () => 998, duration: () => 1000 });
    act(() => fwd.result.current.tap(1));
    expect(fwd.result.current.preview).toBe(999);
  });
});

describe('useSeekGesture press/release', () => {
  it('press shows the first step immediately; release commits after settling', () => {
    const { result, seekTo } = gesture();
    act(() => result.current.press(1));
    expect(result.current.preview).toBe(105);
    act(() => result.current.release());
    expect(seekTo).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(450));
    expect(seekTo).toHaveBeenCalledWith(105);
  });

  it('ignores key auto-repeat (a second press while active is a no-op)', () => {
    const { result } = gesture();
    act(() => result.current.press(1)); // 105
    act(() => result.current.press(1)); // repeat, ignored (still 105, not 110)
    expect(result.current.preview).toBe(105);
  });

  it('a held press becomes an accelerating scrub and commits once on release', () => {
    const seekTo = vi.fn();
    // Large duration so the scrub never hits the clamp.
    const { result } = gesture({ getPosition: () => 100, duration: () => 1_000_000, seekTo });
    act(() => result.current.press(1)); // optimistic 105
    // Cross HOLD_MS (320ms) then run the rAF scrub for a while.
    act(() => vi.advanceTimersByTime(320 + 400));
    const held = result.current.preview;
    expect(held).not.toBeNull();
    expect(held as number).toBeGreaterThan(105); // advanced past the single tap
    act(() => result.current.release());
    expect(seekTo).toHaveBeenCalledTimes(1);
    expect(seekTo).toHaveBeenCalledWith(held);
    expect(result.current.preview).toBeNull();
  });
});

describe('useSeekGesture scrub (pointer drag)', () => {
  it('scrub previews an absolute clamped position and commit issues the seek', () => {
    const { result, seekTo } = gesture({ duration: () => 1000 });
    act(() => result.current.scrub(500));
    expect(result.current.preview).toBe(500);
    act(() => result.current.scrub(5000)); // clamps to duration-1
    expect(result.current.preview).toBe(999);
    act(() => result.current.commit());
    expect(seekTo).toHaveBeenCalledWith(999);
    expect(result.current.preview).toBeNull();
  });

  it('with an unknown duration (0) scrub only floors at 0', () => {
    const { result } = gesture({ duration: () => 0 });
    act(() => result.current.scrub(-50));
    expect(result.current.preview).toBe(0);
    act(() => result.current.scrub(42));
    expect(result.current.preview).toBe(42);
  });
});

describe('useSeekGesture global release + unmount flush', () => {
  it('a window keyup ends an in-flight directional press', () => {
    const { result, seekTo } = gesture();
    act(() => result.current.press(1)); // 105, pending
    act(() => window.dispatchEvent(new KeyboardEvent('keyup')));
    act(() => vi.advanceTimersByTime(450)); // release armed the tap-commit
    expect(seekTo).toHaveBeenCalledWith(105);
  });

  it('flushes a pending preview as a seek when unmounted mid-gesture', () => {
    const seekTo = vi.fn();
    const { result, unmount } = gesture({ seekTo });
    act(() => result.current.scrub(300));
    unmount();
    expect(seekTo).toHaveBeenCalledWith(300);
  });
});
