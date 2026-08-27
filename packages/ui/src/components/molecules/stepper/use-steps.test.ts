// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { useSteps } from './use-steps';

describe('useSteps', () => {
  const steps = ['account', 'library', 'done'];

  it('opens on the first step with nowhere to go back to', () => {
    const { result } = renderHook(() => useSteps(steps));

    expect(result.current).toMatchObject({ value: 'account', index: 0, count: 3, first: true });
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(true);
  });

  it('opens every step it has been past, and none of the ones ahead', () => {
    const { result } = renderHook(() => useSteps(steps));

    act(() => result.current.next());

    expect(result.current.complete('account')).toBe(true);
    expect(result.current.reachable('account')).toBe(true);
    expect(result.current.reachable('done')).toBe(false);
  });

  it('goes to a step ahead when its owner says so, rather than the indicator', () => {
    const { result } = renderHook(() => useSteps(steps));

    act(() => result.current.goTo('done'));

    expect(result.current.value).toBe('done');
    expect(result.current.reachable('library')).toBe(true);
  });

  it('goes back to the first step and forgets how far it went', () => {
    const { result } = renderHook(() => useSteps(steps));

    act(() => result.current.goTo('done'));
    act(() => result.current.reset());

    expect(result.current.value).toBe('account');
    expect(result.current.reachable('library')).toBe(false);
  });

  it('keeps one identity for every callback a caller may depend on', () => {
    const { result, rerender } = renderHook(() => useSteps(steps));
    const first = result.current;

    act(() => result.current.next());
    rerender();

    expect(result.current.next).toBe(first.next);
    expect(result.current.previous).toBe(first.previous);
    expect(result.current.goTo).toBe(first.goTo);
    expect(result.current.reset).toBe(first.reset);
  });
});
