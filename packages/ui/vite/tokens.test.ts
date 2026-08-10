import { describe, expect, it } from 'vitest';
import { colors, lightColors } from '../src/core/tokens/colors';
import { baseCss, fontsCss, kromaCss, kromaTokens, themeCss, tokensCss } from './tokens';

const transform = (code: string, id = '/app/src/styles.css') => {
  const plugin = kromaTokens();
  return plugin.transform(code, id)?.code ?? null;
};

describe('tokensCss', () => {
  it('emits every colour the palette declares', () => {
    const css = tokensCss();
    for (const token of Object.keys(colors)) {
      const name = token
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/surface(\d)/, 'surface-$1');
      expect(css).toContain(`--kroma-${name}:`);
    }
  });

  it('keeps light behind an explicit opt-in, never prefers-color-scheme', () => {
    const css = tokensCss();
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('leaves the dark palette as the bare-root default', () => {
    const root = tokensCss().split(':root[data-theme="light"]')[0] ?? '';
    expect(root).toContain(`--kroma-bg: ${colors.bg.toLowerCase()};`);
    expect(root).not.toContain(lightColors.bg.toLowerCase());
  });

  it('spells the irregular names the stylesheets already consume', () => {
    const css = tokensCss();
    expect(css).toContain('--kroma-surface-1:');
    expect(css).toContain('--kroma-h265:');
    expect(css).toContain('--kroma-accent-soft-hover:');
  });
});

describe('themeCss', () => {
  it('points every Tailwind colour at its token', () => {
    expect(themeCss()).toContain('--color-accent: var(--kroma-accent);');
  });

  it('shortens the text tokens so the utility is not text-text-muted', () => {
    const css = themeCss();
    expect(css).toContain('--color-muted: var(--kroma-text-muted);');
    expect(css).toContain('--color-dim: var(--kroma-text-dim);');
  });
});

describe('fontsCss', () => {
  it('names the woff2 after the family in the typography tokens', () => {
    const css = fontsCss();
    expect(css).toContain('hanken-grotesk-latin.woff2');
    expect(css).toContain('bricolage-grotesque-latin-ext.woff2');
  });

  it('declares one face per family per subset', () => {
    expect(fontsCss().match(/@font-face/g)).toHaveLength(4);
  });
});

describe('the plugin', () => {
  it('expands the aggregate into type, tokens, motion and the reset', () => {
    const css = transform('@import "@kroma/ui/css";');
    expect(css).toContain('@font-face');
    expect(css).toContain('--kroma-bg:');
    expect(css).toContain('@keyframes kroma-img-in');
    expect(css).toContain('box-sizing: border-box;');
  });

  it('expands each half on its own', () => {
    expect(transform('@import "@kroma/ui/css/tokens";')).toBe(tokensCss());
    expect(transform('@import "@kroma/ui/css/theme";')).toBe(themeCss());
    expect(transform('@import "@kroma/ui/css/fonts";')).toBe(fontsCss());
    expect(transform('@import "@kroma/ui/css/base";')).toBe(baseCss());
  });

  it('accepts single quotes and stray whitespace', () => {
    expect(transform("@import '@kroma/ui/css/tokens' ;")).toBe(tokensCss());
  });

  it('leaves a stylesheet without a directive alone', () => {
    expect(transform('body { color: red; }')).toBeNull();
  });

  it('ignores anything that is not CSS', () => {
    expect(transform('@import "@kroma/ui/css";', '/app/src/main.tsx')).toBeNull();
  });

  it('refuses a suffix it does not know rather than guessing', () => {
    expect(() => transform('@import "@kroma/ui/css/tokns";')).toThrow(/no such stylesheet/);
  });

  it('expands every directive in one stylesheet', () => {
    const css = transform('@import "@kroma/ui/css/tokens";\n@import "@kroma/ui/css/theme";');
    expect(css).toContain('--kroma-bg:');
    expect(css).toContain('@theme');
  });

  it('sweeps an emitted asset the transform could not reach', () => {
    const plugin = kromaTokens();
    const bundle = {
      'a.css': { type: 'asset', fileName: 'a.css', source: '@import "@kroma/ui/css/tokens";' },
      'b.js': { type: 'chunk', fileName: 'b.js', source: '@import "@kroma/ui/css/tokens";' },
    };
    plugin.generateBundle({}, bundle);
    expect(bundle['a.css'].source).toContain('--kroma-bg:');
    expect(bundle['b.js'].source).toBe('@import "@kroma/ui/css/tokens";');
  });
});

describe('kromaCss', () => {
  it('carries no Tailwind at-rule, so a plain app can use it', () => {
    const css = kromaCss();
    expect(css).not.toContain('@theme');
    expect(css).not.toContain('@import "tailwindcss"');
  });
});
