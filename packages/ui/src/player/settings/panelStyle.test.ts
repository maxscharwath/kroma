import { describe, expect, it } from 'vitest';
import { FOCUS_SHADOW_SM } from '../style';
import { menuRowOn, rowStyle, selectRowOff, selectRowOn } from './panelStyle';

describe('rowStyle', () => {
  it('picks the ON style when focused', () => {
    expect(rowStyle({ gap: 1 }, { opacity: 1 }, { opacity: 0 }, true)).toEqual([
      { gap: 1 },
      { opacity: 1 },
    ]);
  });

  it('picks the OFF style when not focused', () => {
    expect(rowStyle({ gap: 1 }, { opacity: 1 }, { opacity: 0 }, false)).toEqual([
      { gap: 1 },
      { opacity: 0 },
    ]);
  });
});

describe('focus-state style atoms', () => {
  it('bakes the shared small focus ring into every ON row', () => {
    expect(selectRowOn.boxShadow).toBe(FOCUS_SHADOW_SM);
    expect(menuRowOn.boxShadow).toBe(FOCUS_SHADOW_SM);
  });

  it('keeps OFF rows transparent, with no ring', () => {
    expect(selectRowOff).toEqual({ backgroundColor: 'transparent' });
    expect(selectRowOff.boxShadow).toBeUndefined();
  });
});
