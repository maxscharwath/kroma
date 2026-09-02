import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import { kroma } from './kroma';

const names = (plugins: unknown[]): string[] =>
  plugins.flat(Number.POSITIVE_INFINITY).map((plugin) => (plugin as Plugin).name);

describe('kroma', () => {
  it('lines up the dev helpers, the catalogs, the design system and the dev tools', () => {
    const listed = names(kroma());

    expect(listed.slice(0, 2)).toEqual(['kroma:deps-without-maps', 'kroma:catalogs']);
    expect(listed.filter((name) => name.startsWith('kroma-')).length).toBeGreaterThan(1);
    expect(listed.at(-1)).toBe('kroma-i18n-devtools');
  });

  it('compiles MDX only for a shell that asks', () => {
    expect(names(kroma({ mdx: true })).length).toBe(names(kroma()).length + 1);
  });
});
