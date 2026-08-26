import { record } from '@kroma/react-audit';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, it, vi } from 'vitest';
import { PerfHud } from '#ui/components/organisms/perf-hud';
import { onScreen } from '#ui/testing';

afterEach(cleanup);

describe('perf hud', () => {
  it('cost per tick', () => {
    vi.useFakeTimers();
    const run = record();
    render(onScreen(<PerfHud enabled />));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const first = run.stop();
    const run2 = record();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const ticks = run2.stop();
    vi.useRealTimers();
    console.log('HUD elements:', first.elementCount, JSON.stringify(first.elements.slice(0, 5)));
    console.log('HUD per 2 ticks: rerenders=', ticks.rerenders, 'commits=', ticks.commits.length);
    console.log('HUD top:', JSON.stringify(ticks.components.slice(0, 6)));
  });
});
