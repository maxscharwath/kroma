// The design system as CSS. A stylesheet writes `@import "@kroma/ui"` for the
// lot, or `@kroma/ui/tokens` / `@kroma/ui/theme` for one half.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { colors, lightColors, splitAlpha, withAlpha } from '../src/core/tokens/colors.ts';
import { cssName, cssVar } from '../src/core/tokens/css-var.ts';
import {
  glow,
  lightShadow,
  motion,
  RING_GAP,
  RING_WIDTH,
  shadow,
  WASH_ALPHA,
} from '../src/core/tokens/effects.ts';
import { gutter, radius, rhythm, space } from '../src/core/tokens/layout.ts';
import { fonts, SELF_HOSTED, tracking, typeSpec } from '../src/core/tokens/typography.ts';
import { scanAlphas } from './alpha-scan.ts';

type ColorToken = keyof typeof colors;

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// The utility reads better than the token does: `text-muted`, not `text-text-muted`.
const UTILITY: Partial<Record<ColorToken, string>> = { textMuted: 'muted', textDim: 'dim' };

const rule = (selector: string, lines: string[]) =>
  `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}`;

const palette = (p: Record<ColorToken, string>) =>
  Object.entries(p).map(([k, v]) => `--kroma-${cssName(k as ColorToken)}: ${v.toLowerCase()};`);

// `white` and `black` are deliberately absent: they mean the same on either
// ground, so the runtime resolves them to a literal and no property is needed.
export const KNOWN_COLOR_NAMES: ReadonlySet<string> = new Set(Object.keys(colors));

// Anchored to the repo, NOT to the working directory: a build runs from the app
// it is building, where these names do not exist, and a scan that silently found
// nothing would emit no alpha steps and leave every `token/NN` fill transparent.
const REPO = fileURLToPath(new URL('../../..', import.meta.url));

export const SOURCE_ROOTS = ['packages', 'apps', 'clients', 'modules'].map((dir) =>
  join(REPO, dir),
);

// The theme derives these from the accent wash at runtime, so no source spells
// them out and the scan cannot find them.
const DERIVED = Object.values(WASH_ALPHA).map((step) => `accentWash/${step}`);

const split = (combo: string) => combo.split('/') as [string, string];

/** One property per `token/NN` the source actually writes, in this palette. */
const alphaVars = (combos: ReadonlySet<string>, p: Record<ColorToken, string>) =>
  [...combos]
    .map(split)
    .filter(([token]) => token in p)
    .sort()
    .map(
      ([token, alpha]) =>
        `${cssVar(token, alpha)}: ${withAlpha(p[token as ColorToken], Number(alpha) / 100)};`,
    );

/** Both halves of a translucent token, for the one consumer that cannot paint
 *  with the whole: see `splitAlpha`. */
const fadedVars = (p: Record<ColorToken, string>) =>
  Object.entries(p).flatMap(([k, v]) => {
    const { color, opacity } = splitAlpha(v);
    if (opacity === 1) return [];
    return [`${cssVar(k)}-opaque: ${color};`, `${cssVar(k)}-alpha: ${opacity};`];
  });

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

const stack = (family: string) =>
  SELF_HOSTED.includes(family) ? `"${family}", system-ui, sans-serif` : family;

const typography = () => [
  ...Object.entries(fonts).map(([k, v]) => `--font-${k}: ${stack(v)};`),
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

// No `--shadow-*` here: elevation moves with the ground, so it is emitted once
// per palette below rather than a second time as a ground-independent default.
const effects = () => [
  ...Object.entries(radius).map(([k, v]) => `--radius-${k}: ${v}px;`),
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

/**
 * Every design token as CSS custom properties.
 *
 * The light palette is behind `[data-theme="light"]` and NOT behind
 * `prefers-color-scheme`, because that query answers `light` for a visitor who
 * has expressed no preference at all - it is the default state, not an opt-in.
 * Gated that way it flipped every dark-only surface to paper while
 * `activeTheme()` stayed on KROMA, so the kit painted dark cards on a light
 * ground. A shell opts in when it is ready to switch both halves together.
 */
export function tokensCss(roots: readonly string[] = SOURCE_ROOTS): string {
  const alphas = scanAlphas(roots, KNOWN_COLOR_NAMES);
  for (const combo of DERIVED) alphas.add(combo);

  const ground = (p: Record<ColorToken, string>, elevation: Record<string, string>) => [
    ...palette(p),
    ...alphaVars(alphas, p),
    ...fadedVars(p),
    ...Object.entries(elevation).map(([k, v]) => `--shadow-${k}: ${v};`),
  ];

  return [
    rule(':root', [...ALIASES, ...typography(), ...spacing(), ...effects()]),
    // ONE rule for the two selectors, not the same block written twice: dark IS
    // the bare-root default. The attribute selector stands on its own, NOT as
    // `:root[data-theme]`, because a ground has to be pinnable on any element so
    // a subtree can hold its own - the player is the case that forces it, its
    // chrome sitting over video and staying dark whatever the page is doing.
    rule(':root,\n[data-theme="dark"]', ground(colors, shadow)),
    // Later and equally specific, so it wins on `<html data-theme="light">` and
    // a light island inside a dark one still resolves light.
    rule('[data-theme="light"]', ground(lightColors, lightShadow)),
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

// Latin and latin-ext cover English and French; both families are variable, so
// one file per subset carries the whole 400-800 range.
const SUBSETS = {
  latin:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext':
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
};

const FONT_DIR = fileURLToPath(new URL('../src/assets/fonts/', import.meta.url));

/**
 * The two typefaces, SELF-HOSTED.
 *
 * A KROMA server is self-hosted, so a television with no route to the internet
 * is a normal deployment: a CDN request there cannot succeed, it can only time
 * out with first paint waiting behind it. Absolute paths so Vite fingerprints
 * and emits the woff2 from wherever the importing stylesheet lives.
 */
export function fontsCss(): string {
  const slug = (family: string) => family.toLowerCase().replace(/\s+/g, '-');
  return SELF_HOSTED.flatMap((family) =>
    Object.entries(SUBSETS).map(([subset, range]) =>
      rule('@font-face', [
        `font-family: "${family}";`,
        'font-style: normal;',
        'font-weight: 400 800;',
        'font-display: swap;',
        `src: url("${FONT_DIR}${slug(family)}-${subset}.woff2") format("woff2");`,
        `unicode-range: ${range};`,
      ]),
    ),
  ).join('\n\n');
}

const readCss = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../src/styles/${name}.css`, import.meta.url)), 'utf8');

/** Keyframes the components animate with, on every browser target. */
export const motionCss = () => readCss('motion');

/** The reset and page furniture a browser target wants. A TV shell supplies its
 *  own, so this is not in the `tokens` half every target shares. */
export const baseCss = () => readCss('base');

/** The whole design system, framework-free: type, tokens, motion and the reset.
 *  A Tailwind app adds `@import "tailwindcss"` and `@kroma/ui/css/theme`. */
export function kromaCss(): string {
  return [fontsCss(), tokensCss(), motionCss(), baseCss()].join('\n\n');
}

// A plain `@import`, the spelling Tailwind v4 uses for itself, rather than a
// custom `@kroma;` at-rule: valid CSS that editors and linters already
// understand. Under `/css` because a bare `@kroma/ui` resolves to the package's
// TypeScript entry, and Tailwind - which resolves imports itself - then tries to
// parse TypeScript as a stylesheet.
const DIRECTIVE = /@import\s+["']@kroma\/ui\/css(\/[a-z]+)?["']\s*;/g;

const EXPANSION: Record<string, () => string> = {
  '': kromaCss,
  '/tokens': tokensCss,
  '/theme': themeCss,
  '/fonts': fontsCss,
  '/motion': motionCss,
  '/base': baseCss,
};

// Unknown suffix throws rather than falling back to the aggregate: `/tokns` is
// a typo, and quietly answering it with the browser reset would put body rules
// into a TV shell that supplies its own.
const expand = (code: string) =>
  code.replace(DIRECTIVE, (_, which: string | undefined) => {
    const emit = EXPANSION[which ?? ''];
    if (!emit) {
      throw new Error(
        `[kroma-ui] no such stylesheet: @kroma/ui/css${which}. Known: ${Object.keys(EXPANSION)
          .map((k) => `@kroma/ui/css${k}`)
          .join(', ')}`,
      );
    }
    return emit();
  });

interface BundleFile {
  type: string;
  fileName: string;
  source?: unknown;
}

interface PluginContext {
  addWatchFile?: (id: string) => void;
}

interface CssPlugin {
  name: string;
  enforce: 'pre';
  transform(this: PluginContext, code: string, id: string): { code: string; map: null } | null;
  generateBundle(options: unknown, bundle: Record<string, BundleFile>): void;
}

// What the emitted stylesheet is actually derived from. Declared as watched, or
// the dev server holds the CSS it generated at startup and a token edited in
// TypeScript silently keeps serving the old value.
const SOURCES = [
  '../src/core/tokens/colors.ts',
  '../src/core/tokens/css-var.ts',
  '../src/core/tokens/effects.ts',
  '../src/core/tokens/layout.ts',
  '../src/core/tokens/typography.ts',
  '../src/styles/base.css',
  '../src/styles/motion.css',
].map((path) => fileURLToPath(new URL(path, import.meta.url)));

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
      for (const file of SOURCES) this.addWatchFile?.(file);
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
