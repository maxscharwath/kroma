// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePlayerOutro } from './use-player-outro';

type Opts = Parameters<typeof usePlayerOutro>[0];

function base(over: Partial<Opts> = {}): Opts {
  return {
    endedNonce: 0,
    hasNext: false,
    hasSuggestions: true,
    onSuggest: vi.fn(),
    onLeave: vi.fn(),
    ...over,
  };
}

describe('usePlayerOutro', () => {
  it('does nothing while the film is still running', () => {
    const opts = base();
    renderHook(() => usePlayerOutro(opts));

    expect(opts.onSuggest).not.toHaveBeenCalled();
    expect(opts.onLeave).not.toHaveBeenCalled();
  });

  it('offers the suggestions when the film ends with something to show', () => {
    const onSuggest = vi.fn();
    const onLeave = vi.fn();
    const { rerender } = renderHook((opts: Opts) => usePlayerOutro(opts), {
      initialProps: base({ onSuggest, onLeave }),
    });

    rerender(base({ endedNonce: 1, onSuggest, onLeave }));

    expect(onSuggest).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('leaves the player when the film ends with nothing to show', () => {
    const onSuggest = vi.fn();
    const onLeave = vi.fn();
    const { rerender } = renderHook((opts: Opts) => usePlayerOutro(opts), {
      initialProps: base({ hasSuggestions: false, onSuggest, onLeave }),
    });

    rerender(base({ endedNonce: 1, hasSuggestions: false, onSuggest, onLeave }));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onSuggest).not.toHaveBeenCalled();
  });

  it('stands aside for the credits countdown when an episode is queued', () => {
    const onSuggest = vi.fn();
    const onLeave = vi.fn();
    const { rerender } = renderHook((opts: Opts) => usePlayerOutro(opts), {
      initialProps: base({ hasNext: true, onSuggest, onLeave }),
    });

    rerender(base({ endedNonce: 1, hasNext: true, onSuggest, onLeave }));

    expect(onSuggest).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('fires once per end, so closing the sheet does not reopen it', () => {
    const onSuggest = vi.fn();
    const { rerender } = renderHook((opts: Opts) => usePlayerOutro(opts), {
      initialProps: base({ onSuggest }),
    });

    rerender(base({ endedNonce: 1, onSuggest }));
    rerender(base({ endedNonce: 1, onSuggest }));

    expect(onSuggest).toHaveBeenCalledTimes(1);
  });

  it('ignores a nonce inherited from the title that came before', () => {
    const onSuggest = vi.fn();
    const onLeave = vi.fn();
    renderHook((opts: Opts) => usePlayerOutro(opts), {
      initialProps: base({ endedNonce: 3, onSuggest, onLeave }),
    });

    expect(onSuggest).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });
});
