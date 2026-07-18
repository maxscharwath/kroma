import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SUB_APPEARANCE,
  SUB_COLORS,
  type SubtitleAppearance,
  subtitleCss,
} from './subtitle-appearance';

const base = (over: Partial<SubtitleAppearance> = {}): SubtitleAppearance => ({
  ...DEFAULT_SUB_APPEARANCE,
  ...over,
});

describe('subtitle appearance constants', () => {
  it('defaults to a readable white shadowed 100% md style', () => {
    expect(DEFAULT_SUB_APPEARANCE).toEqual({
      size: 'md',
      color: '#FFFFFF',
      edge: 'shadow',
      font: 'sans',
      opacity: 100,
      bgOpacity: 75,
    });
  });

  it('exposes the five-swatch palette', () => {
    expect(SUB_COLORS).toHaveLength(5);
    expect(SUB_COLORS[0]).toBe('#FFFFFF');
  });
});

describe('subtitleCss', () => {
  it('maps each size to its pixel value', () => {
    expect(subtitleCss(base({ size: 'sm' })).fontSize).toBe(26);
    expect(subtitleCss(base({ size: 'md' })).fontSize).toBe(36);
    expect(subtitleCss(base({ size: 'lg' })).fontSize).toBe(48);
    expect(subtitleCss(base({ size: 'xl' })).fontSize).toBe(62);
  });

  it('maps each font to a stack, and passes the color through', () => {
    expect(String(subtitleCss(base({ font: 'sans' })).fontFamily)).toContain('Hanken Grotesk');
    expect(String(subtitleCss(base({ font: 'serif' })).fontFamily)).toContain('Georgia');
    expect(String(subtitleCss(base({ font: 'mono' })).fontFamily)).toContain('SF Mono');
    expect(subtitleCss(base({ color: '#F5E050' })).color).toBe('#F5E050');
  });

  it('clamps opacity into [0.2, 1]', () => {
    expect(subtitleCss(base({ opacity: 100 })).opacity).toBe(1);
    expect(subtitleCss(base({ opacity: 50 })).opacity).toBe(0.5);
    expect(subtitleCss(base({ opacity: 0 })).opacity).toBe(0.2); // floor
    expect(subtitleCss(base({ opacity: 500 })).opacity).toBe(1); // ceiling
  });

  it('shadow edge sets a text shadow and no padding/background', () => {
    const css = subtitleCss(base({ edge: 'shadow' }));
    expect(css.textShadow).toContain('rgba(0,0,0,.92)');
    expect(css.padding).toBeUndefined();
    expect(css.background).toBeUndefined();
  });

  it('outline edge renders a four-corner stroke', () => {
    const css = subtitleCss(base({ edge: 'outline' }));
    expect(css.textShadow).toContain('-1.5px -1.5px 0 #000');
  });

  it('box edge applies padding and a bgOpacity-scaled background, no shadow', () => {
    const css = subtitleCss(base({ edge: 'box', bgOpacity: 50 }));
    expect(css.padding).toBe('4px 16px');
    expect(css.background).toBe('rgba(0,0,0,0.5)');
    expect(css.textShadow).toBeUndefined();
  });

  it('clamps the box background opacity into [0, 1]', () => {
    expect(subtitleCss(base({ edge: 'box', bgOpacity: 250 })).background).toBe('rgba(0,0,0,1)');
    expect(subtitleCss(base({ edge: 'box', bgOpacity: -10 })).background).toBe('rgba(0,0,0,0)');
  });

  it('none edge has neither shadow nor background', () => {
    const css = subtitleCss(base({ edge: 'none' }));
    expect(css.textShadow).toBeUndefined();
    expect(css.background).toBeUndefined();
  });
});
