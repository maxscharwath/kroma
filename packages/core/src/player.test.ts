import { describe, expect, it } from 'vitest';
import { formatRuntime } from './player';

// `attachDirectPlay` needs a real HTMLVideoElement + DOM event wiring, so it is
// exercised by the client shells, not this node-env unit test. `formatRuntime`
// is the pure part.

describe('formatRuntime', () => {
  it('formats hours and zero-padded minutes', () => {
    expect(formatRuntime(7620000)).toBe('2h07'); // 127 min
    expect(formatRuntime(3600000)).toBe('1h00'); // exactly 1h
    expect(formatRuntime(3660000)).toBe('1h01');
  });

  it('formats sub-hour durations as minutes only', () => {
    expect(formatRuntime(2820000)).toBe('47min');
    expect(formatRuntime(60000)).toBe('1min');
  });

  it('rounds to the nearest minute', () => {
    // 89 s rounds to 1 min.
    expect(formatRuntime(89000)).toBe('1min');
    // 29 s rounds to 0 min.
    expect(formatRuntime(29000)).toBe('0min');
  });

  it('returns an empty string for missing / non-positive durations', () => {
    expect(formatRuntime(0)).toBe('');
    expect(formatRuntime(-5000)).toBe('');
    expect(formatRuntime(null)).toBe('');
    expect(formatRuntime(undefined)).toBe('');
  });
});
