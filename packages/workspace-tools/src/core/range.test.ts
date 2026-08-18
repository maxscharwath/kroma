import { describe, expect, it } from 'vitest';
import { satisfies } from './range';

describe('satisfies', () => {
  it('handles exact and wildcard', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
    expect(satisfies('1.2.4', '1.2.3')).toBe(false);
    expect(satisfies('9.9.9', '*')).toBe(true);
    expect(satisfies('9.9.9', '')).toBe(true);
  });

  it('handles caret on a non-zero major', () => {
    expect(satisfies('1.5.0', '^1.2.3')).toBe(true);
    expect(satisfies('1.2.3', '^1.2.3')).toBe(true);
    expect(satisfies('2.0.0', '^1.2.3')).toBe(false);
    expect(satisfies('1.2.2', '^1.2.3')).toBe(false);
  });

  it('handles caret on 0.x (the module case, ^0.1.0)', () => {
    expect(satisfies('0.1.8', '^0.1.0')).toBe(true);
    expect(satisfies('0.1.0', '^0.1.0')).toBe(true);
    expect(satisfies('0.2.0', '^0.1.0')).toBe(false);
    expect(satisfies('0.0.9', '^0.1.0')).toBe(false);
  });

  it('handles tilde and >=', () => {
    expect(satisfies('1.2.9', '~1.2.3')).toBe(true);
    expect(satisfies('1.3.0', '~1.2.3')).toBe(false);
    expect(satisfies('0.1.4', '>=0.1.4')).toBe(true);
    expect(satisfies('0.1.3', '>=0.1.4')).toBe(false);
  });

  it('tolerates a leading v; a pre-release does NOT satisfy a stable range', () => {
    expect(satisfies('v1.2.3', '^1.0.0')).toBe(true);
    expect(satisfies('1.2.3-rc1', '^1.2.3')).toBe(false);
  });

  it('returns false for a malformed version or range instead of throwing', () => {
    expect(satisfies('not-a-version', '^1.0.0')).toBe(false);
    expect(satisfies('1.0.0', 'garbage')).toBe(false);
    expect(satisfies('1.0.0', '^oops')).toBe(false);
    expect(satisfies('', '^1.0.0')).toBe(false);
  });

  it('caret on 0.0.x is exact-patch only', () => {
    expect(satisfies('0.0.3', '^0.0.3')).toBe(true);
    expect(satisfies('0.0.4', '^0.0.3')).toBe(false);
  });

  describe('pre-releases', () => {
    it('a stable range never matches a pre-release', () => {
      expect(satisfies('0.2.0-beta.1', '^0.1.0')).toBe(false);
      expect(satisfies('1.5.0-beta', '^1.2.3')).toBe(false);
      expect(satisfies('1.0.0-rc.1', '*')).toBe(false);
    });

    it('a pre-release satisfies a range whose comparator is a pre-release of the same X.Y.Z', () => {
      expect(satisfies('1.2.3-beta.2', '^1.2.3-beta.1')).toBe(true);
      expect(satisfies('1.2.3-beta.1', '>=1.2.3-beta.1')).toBe(true);
    });

    it('a pre-release does not leak across X.Y.Z even with a pre-release range', () => {
      expect(satisfies('1.3.0-beta.1', '^1.2.3-beta.1')).toBe(false);
    });

    it('a stable release still satisfies its ranges', () => {
      expect(satisfies('1.2.3', '^1.2.3-beta.1')).toBe(true);
      expect(satisfies('1.2.4', '^1.2.3')).toBe(true);
    });
  });
});
