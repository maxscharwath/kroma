// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { injectRules } from './inject';

const sheets = () => [...document.querySelectorAll('style[data-kroma-atomic]')];

const rulesOf = (element: Element) =>
  [...((element as HTMLStyleElement).sheet?.cssRules ?? [])].map((rule) =>
    rule.cssText.replace(/\s+/g, ''),
  );

describe('injectRules', () => {
  it('inserts each rule once, into a sheet per group, groups in order', () => {
    injectRules([
      [3, '.r-a{opacity:0.5;}'],
      [2, '.r-b{margin:0px;}'],
    ]);
    injectRules([
      [3, '.r-a{opacity:0.5;}'],
      [3, '.r-c{top:0px;}'],
    ]);

    const [low, high] = sheets();
    expect(sheets().map((element) => element.getAttribute('data-kroma-atomic'))).toEqual([
      '2',
      '3',
    ]);
    expect(rulesOf(low as Element)).toEqual(['.r-b{margin:0px;}']);
    expect(rulesOf(high as Element)).toEqual(['.r-a{opacity:0.5;}', '.r-c{top:0px;}']);
  });

  it('places a group that arrives late before the groups above it', () => {
    injectRules([[1, '.r-reset{padding:0px;}']]);

    expect(sheets().map((element) => element.getAttribute('data-kroma-atomic'))).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('skips a rule the engine cannot parse and keeps going', () => {
    expect(() =>
      injectRules([
        [3, 'not css at all'],
        [3, '.r-d{left:0px;}'],
      ]),
    ).not.toThrow();

    expect(rulesOf(sheets()[2] as Element)).toContain('.r-d{left:0px;}');
  });
});
