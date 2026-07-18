import { afterEach, describe, expect, it, vi } from 'vitest';
import { clock, dur, rel } from './jobs-format';

afterEach(() => vi.useRealTimers());

// Compare against a locally-constructed formatter so assertions stay independent
// of the runtime's default locale.
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const NOW = new Date('2026-01-01T12:00:00Z').getTime();

describe('rel', () => {
  it('formats sub-minute diffs in seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(rel(NOW + 3000)).toBe(rtf.format(3, 'second'));
    expect(rel(NOW - 5000)).toBe(rtf.format(-5, 'second'));
  });

  it('rolls up to minutes / hours / days at each boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(rel(NOW + 60_000)).toBe(rtf.format(1, 'minute')); // exactly 1 min
    expect(rel(NOW + 90_000)).toBe(rtf.format(2, 'minute'));
    expect(rel(NOW + 7_200_000)).toBe(rtf.format(2, 'hour'));
    expect(rel(NOW + 3 * 86_400_000)).toBe(rtf.format(3, 'day'));
  });
});

describe('dur', () => {
  it('shows whole milliseconds below one second', () => {
    expect(dur(0)).toBe('0 ms');
    expect(dur(820)).toBe('820 ms');
  });

  it('shows one decimal of seconds below a minute', () => {
    expect(dur(1000)).toBe('1.0 s');
    expect(dur(4300)).toBe('4.3 s');
    expect(dur(59_900)).toBe('59.9 s');
  });

  it('shows "M min SS s" from a minute up, zero-padding seconds', () => {
    expect(dur(60_000)).toBe('1 min 00 s');
    expect(dur(125_000)).toBe('2 min 05 s');
  });

  it('rounds to whole seconds first, avoiding a stray "60 s" tail', () => {
    expect(dur(119_600)).toBe('2 min 00 s');
  });
});

describe('clock', () => {
  it('renders an hh:mm wall-clock time', () => {
    expect(clock(NOW)).toMatch(/\d{1,2}:\d{2}/);
  });
});
