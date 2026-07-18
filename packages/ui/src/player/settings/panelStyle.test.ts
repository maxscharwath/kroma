import { describe, expect, it } from 'vitest';
import { FOCUS_RING_SM } from '../tw';
import { menuRowOn, rowCx, selectRowOff, selectRowOn } from './panelStyle';

describe('rowCx', () => {
  it('appends the ON classes when focused', () => {
    expect(rowCx('base', 'on', 'off', true)).toBe('base on');
  });

  it('appends the OFF classes when not focused', () => {
    expect(rowCx('base', 'on', 'off', false)).toBe('base off');
  });
});

describe('focus-state class atoms', () => {
  it('bakes the shared small focus ring into every ON row', () => {
    expect(selectRowOn).toContain(FOCUS_RING_SM);
    expect(menuRowOn).toContain(FOCUS_RING_SM);
  });

  it('keeps OFF rows transparent (no ring)', () => {
    expect(selectRowOff).toBe('bg-transparent');
    expect(selectRowOff).not.toContain(FOCUS_RING_SM);
  });
});
