import { describe, expect, it } from 'vitest';
import { motion } from '#ui/core/tokens';
import { pressScaleFor } from './press-dip';

describe('the press dip', () => {
  it('falls back to the design floor while unmeasured', () => {
    expect(pressScaleFor(0)).toBe(motion.pressScale);
  });

  it('keeps the deep dip on a small control', () => {
    expect(pressScaleFor(60)).toBe(motion.pressScale);
    expect(pressScaleFor(120)).toBe(motion.pressScale);
  });

  it('lands the same pixel travel on a wide row', () => {
    expect(900 * (1 - pressScaleFor(900))).toBeCloseTo(6);
    expect(2000 * (1 - pressScaleFor(2000))).toBeCloseTo(6);
  });

  it('never dips deeper than the floor', () => {
    for (const size of [1, 40, 200, 640, 1600]) {
      expect(pressScaleFor(size)).toBeGreaterThanOrEqual(motion.pressScale);
      expect(pressScaleFor(size)).toBeLessThan(1);
    }
  });
});
