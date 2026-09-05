import { StyleSheet } from 'react-native';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileDeclaration } from './declaration.ts';
import { Unstatic } from './module-scope.ts';
import { resolveAsBrowser } from './web-theme.ts';

beforeAll(() => resolveAsBrowser());

describe('compileDeclaration', () => {
  it('resolves the vocabulary to longhands and a class per longhand', () => {
    const leaf = compileDeclaration({ row: true, px: 8, bg: 'accent', radius: 'sm' });

    expect(leaf.values).toEqual({
      flexDirection: 'row',
      paddingLeft: 8,
      paddingRight: 8,
      backgroundColor: 'var(--kroma-accent)',
      borderRadius: 8,
    });
    expect(leaf.rules.map((rule) => rule.css)).toContainEqual(
      expect.stringContaining('{background-color:var(--kroma-accent);}'),
    );
    expect(leaf.states).toBeUndefined();
  });

  it('emits the classes and rules the browser runtime would have minted', () => {
    const leaf = compileDeclaration({ py: 6, color: 'textMuted', opacity: 0.5 });

    StyleSheet.create({ probe: leaf.values as never });

    const runtime = (StyleSheet as unknown as { getSheet(): { textContent: string } }).getSheet()
      .textContent;
    for (const rule of leaf.rules) expect(runtime).toContain(rule.css);
  });

  it('orders a shorthand under the longhands, as the runtime does', () => {
    const leaf = compileDeclaration({ radius: 'lg', borderTopLeftRadius: 0 });

    const groups = Object.fromEntries(leaf.rules.map((rule) => [rule.css, rule.group]));
    const radius = Object.keys(groups).find((css) => css.includes('border-bottom-left-radius'));
    const corner = Object.keys(groups).find(
      (css) => css.startsWith('.r-') && css.includes('{border-top-left-radius:0px;}'),
    );
    expect(groups[radius as string]).toBeLessThan(groups[corner as string] as number);
  });

  it('compiles each interaction state to its own layer', () => {
    const leaf = compileDeclaration({
      bg: 'accent',
      _hover: { bg: 'accentHover' },
      _press: { opacity: 0.8 },
    });

    expect(Object.keys(leaf.states ?? {})).toEqual(['hover', 'press']);
    expect(leaf.states?.hover).toEqual({ backgroundColor: 'var(--kroma-accent-hover)' });
    expect(leaf.states?.press).toEqual({ opacity: 0.8 });
    expect(leaf.rules.map((rule) => rule.css)).toContainEqual(
      expect.stringContaining('{opacity:0.8;}'),
    );
  });

  it('leaves the runtime what only it can resolve', () => {
    expect(() => compileDeclaration({ px: { base: 8, md: 12 } })).toThrow(Unstatic);
    expect(() => compileDeclaration({ px: { base: 8, md: 12 } })).toThrow(/per breakpoint/);
    expect(() => compileDeclaration({ width: (() => 1) as never })).toThrow(/a function/);
  });

  it('keeps what the browser cannot paint in the values, with no rule for it', () => {
    const leaf = compileDeclaration({ resizeMode: 'cover', tintColor: 'accent' } as never);

    expect(leaf.rules).toEqual([]);
    expect(leaf.values).toEqual({ resizeMode: 'cover', tintColor: 'var(--kroma-accent)' });
  });
});
