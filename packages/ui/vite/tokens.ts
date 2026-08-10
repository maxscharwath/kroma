// The design system as CSS. A stylesheet writes `@import "@kroma/ui"` for the
// lot, or `@kroma/ui/tokens` / `@kroma/ui/theme` for one half.

import { colors, lightColors } from '../src/core/tokens/colors.ts';
import { glow, motion, RING_GAP, RING_WIDTH, shadow } from '../src/core/tokens/effects.ts';
import { gutter, radius, rhythm, space } from '../src/core/tokens/layout.ts';
import { fonts, tracking, typeSpec } from '../src/core/tokens/typography.ts';

type ColorToken = keyof typeof colors;

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// `surface1` is the only shape kebab-case gets wrong: a digit is not a word
// boundary, which is exactly what keeps `h265` intact.
const IRREGULAR: Partial<Record<ColorToken, string>> = {
  surface1: 'surface-1',
  surface2: 'surface-2',
  surface3: 'surface-3',
};

const cssName = (k: ColorToken) => IRREGULAR[k] ?? kebab(k);

// The utility reads better than the token does: `text-muted`, not `text-text-muted`.
const UTILITY: Partial<Record<ColorToken, string>> = { textMuted: 'muted', textDim: 'dim' };

const rule = (selector: string, lines: string[], indent = '') =>
  `${indent}${selector} {\n${lines.map((l) => `${indent}  ${l}`).join('\n')}\n${indent}}`;

const palette = (p: Record<ColorToken, string>) =>
  Object.entries(p).map(([k, v]) => `--kroma-${cssName(k as ColorToken)}: ${v.toLowerCase()};`);

const ALIASES = [
  '--surface-page: var(--kroma-bg);',
  '--surface-card: var(--kroma-surface-1);',
  '--surface-raised: var(--kroma-surface-2);',
  '--text-body: var(--kroma-text);',
  '--text-secondary: var(--kroma-text-muted);',
  '--text-tertiary: var(--kroma-text-dim);',
  '--brand: var(--kroma-accent);',
  '--brand-ink: var(--kroma-accent-ink);',
];

const typography = () => [
  `--font-display: "${fonts.display}", system-ui, sans-serif;`,
  `--font-ui: "${fonts.ui}", system-ui, sans-serif;`,
  ...Object.entries(typeSpec).map(
    ([k, s]) => `--type-${kebab(k)}: ${s.weight} ${s.size}px / ${s.ratio} var(--font-${s.family});`,
  ),
  ...Object.entries(tracking).map(([k, v]) => `--tracking-${kebab(k)}: ${v}em;`),
];

const spacing = () => [
  ...Object.entries(space).map(([k, v]) => `--space-${k}: ${v}px;`),
  ...Object.entries(gutter).map(([k, v]) => `--gutter-${k}: ${v}px;`),
  `--row-gap: ${rhythm.rowGap}px;`,
  `--card-w: ${rhythm.cardWidth}px;`,
];

const effects = () => [
  ...Object.entries(radius).map(([k, v]) => `--radius-${k}: ${v}px;`),
  ...Object.entries(shadow).map(([k, v]) => `--shadow-${k}: ${v};`),
  `--ring-width: ${RING_WIDTH}px;`,
  `--ring-gap: ${RING_GAP}px;`,
  // var(), not the literal hex, so a themed accent retints every ring.
  `--ring-outline: ${RING_WIDTH}px solid var(--kroma-accent);`,
  ...Object.entries(glow).map(([k, v]) => `--glow-${k}: ${v};`),
  `--ease-out: cubic-bezier(${motion.bezier.out.join(', ')});`,
  `--ease-spring: cubic-bezier(${motion.bezier.spring.join(', ')});`,
  ...Object.entries(motion.duration).map(([k, v]) => `--dur-${k}: ${v / 1000}s;`),
  `--press-scale: ${motion.pressScale};`,
  `--hover-lift: ${motion.focusLift}px;`,
];

/** Every design token as CSS custom properties, both palettes. */
export function tokensCss(): string {
  const light = palette(lightColors);
  return [
    rule(':root', [...palette(colors), ...ALIASES, ...typography(), ...spacing(), ...effects()]),
    `@media (prefers-color-scheme: light) {\n${rule(':root:not([data-theme="dark"])', light, '  ')}\n}`,
    rule(':root[data-theme="light"]', light),
  ].join('\n\n');
}

/** The Tailwind v4 bridge: `bg-accent`, `text-muted`, `rounded-lg`, `shadow-card`. */
export function themeCss(): string {
  return rule('@theme', [
    ...(Object.keys(colors) as ColorToken[]).map(
      (k) => `--color-${UTILITY[k] ?? cssName(k)}: var(--kroma-${cssName(k)});`,
    ),
    `--font-sans: "${fonts.ui}", system-ui, sans-serif;`,
    `--font-display: "${fonts.display}", system-ui, sans-serif;`,
    ...Object.entries(radius).map(([k, v]) => `--radius-${k}: ${v}px;`),
    ...Object.entries(shadow).map(([k, v]) => `--shadow-${k}: ${v};`),
    `--ease-out: cubic-bezier(${motion.bezier.out.join(', ')});`,
    `--ease-spring: cubic-bezier(${motion.bezier.spring.join(', ')});`,
  ]);
}

/** Fonts, Tailwind, the tokens and the bridge: everything an app entry needs. */
export function kromaCss(): string {
  return ['@import "@kroma/ui/fonts.css";', '@import "tailwindcss";', tokensCss(), themeCss()].join(
    '\n',
  );
}

// A plain `@import`, the spelling Tailwind v4 uses for itself, rather than a
// custom `@kroma;` at-rule: valid CSS that editors and linters already
// understand. Under `/css` because a bare `@kroma/ui` resolves to the package's
// TypeScript entry, and Tailwind - which resolves imports itself - then tries to
// parse TypeScript as a stylesheet.
const DIRECTIVE = /@import\s+["']@kroma\/ui\/css(\/tokens|\/theme)?["']\s*;/g;

const EXPANSION: Record<string, () => string> = {
  '': kromaCss,
  '/tokens': tokensCss,
  '/theme': themeCss,
};

const expand = (code: string) =>
  code.replace(DIRECTIVE, (_, which: string | undefined) => (EXPANSION[which ?? ''] ?? kromaCss)());

interface BundleFile {
  type: string;
  fileName: string;
  source?: unknown;
}

interface CssPlugin {
  name: string;
  enforce: 'pre';
  transform(code: string, id: string): { code: string; map: null } | null;
  generateBundle(options: unknown, bundle: Record<string, BundleFile>): void;
}

/**
 * Expands the KROMA directives, the way `@import "tailwindcss"` expands into
 * Tailwind.
 *
 * Two hooks, because Vite reaches a stylesheet two different ways. `transform`
 * sees the file an app imports from JS, which is where a directive belongs. A
 * stylesheet pulled in by a nested CSS `@import` never reaches the plugin
 * container at all - Vite inlines those inside its own CSS plugin - so
 * `generateBundle` sweeps the emitted assets for whatever the first hook could
 * not see.
 */
export function kromaTokens(): CssPlugin {
  return {
    name: 'kroma-tokens',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('.css')) return null;
      DIRECTIVE.lastIndex = 0;
      if (!DIRECTIVE.test(code)) return null;
      return { code: expand(code), map: null };
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;
        if (typeof file.source !== 'string' || !file.source.includes('@kroma/ui')) continue;
        file.source = expand(file.source);
      }
    },
  };
}
