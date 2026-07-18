import { describe, expect, it, vi } from 'vitest';
import { match } from './match';

describe('match', () => {
  it('returns the first winning branch (predicate)', () => {
    const label = match({ hdr: true, width: 3840 })
      .when((v) => v.hdr, 'HDR')
      .when((v) => v.width >= 3840, '4K')
      .otherwise(null);
    expect(label).toBe('HDR');
  });

  it('skips a failing predicate and takes the next match', () => {
    const label = match({ hdr: false, width: 3840 })
      .when((v) => v.hdr, 'HDR')
      .when((v) => v.width >= 3840, '4K')
      .otherwise(null);
    expect(label).toBe('4K');
  });

  it('falls through to otherwise when nothing matches', () => {
    const label = match({ hdr: false, width: 1920 })
      .when((v) => v.hdr, 'HDR')
      .when((v) => v.width >= 3840, '4K')
      .otherwise('SD');
    expect(label).toBe('SD');
  });

  it('compares by strict value equality when cond is not a function', () => {
    const icon = match('error').when('ready', 'ok').when('error', 'x').otherwise('...');
    expect(icon).toBe('x');
  });

  it('evaluates the winning produce lazily and only once', () => {
    const winner = vi.fn(() => 'W');
    const loser = vi.fn(() => 'L');
    const result = match(1)
      .when((n) => n === 1, winner)
      .when((n) => n === 1, loser)
      .otherwise(() => 'fallback');
    expect(result).toBe('W');
    expect(winner).toHaveBeenCalledTimes(1);
    // Later branches must not run once a winner is found.
    expect(loser).not.toHaveBeenCalled();
  });

  it('passes the matched value into a lazy producer', () => {
    const result = match(21)
      .when(
        (n) => n > 10,
        (n) => n * 2,
      )
      .otherwise(0);
    expect(result).toBe(42);
  });

  it('evaluates a lazy otherwise with the value when no branch matches', () => {
    const fallback = vi.fn((n: number) => `#${n}`);
    expect(
      match(7)
        .when((n) => n < 0, 'neg')
        .otherwise(fallback),
    ).toBe('#7');
    expect(fallback).toHaveBeenCalledWith(7);
  });

  it('does not run predicates after the first match', () => {
    const later = vi.fn(() => true);
    match('a').when('a', 'first').when(later, 'second').otherwise('none');
    expect(later).not.toHaveBeenCalled();
  });
});
