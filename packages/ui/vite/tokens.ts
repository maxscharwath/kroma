// The design tokens as CSS custom properties, expanded into any stylesheet that
// writes `@kroma-tokens;`. The TypeScript tokens are the only source of truth -
// nothing is generated into the repo, so the two cannot drift.

import { colors, lightColors } from '../src/core/tokens/colors.ts';
import { glow, motion, RING_GAP, RING_WIDTH, shadow } from '../src/core/tokens/effects.ts';
import { gutter, radius, rhythm, space } from '../src/core/tokens/layout.ts';
import { fonts, tracking, typeSpec } from '../src/core/tokens/typography.ts';

type Palette = Record<keyof typeof colors, string>;

const bezier = (b: readonly number[]) => `cubic-bezier(${b.join(', ')})`;
const section = (title: string) => ['', `  /* ${title} */`];
const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const block = (lines: string[]) => `:root {\n${lines.join('\n')}\n}\n`;

// Explicit rather than derived: `surface1` and `h265` do not kebab-case the same
// way, and these names are a contract the web + desktop stylesheets consume.
const CSS_COLOR: Record<keyof typeof colors, string> = {
  bg: 'bg',
  surface1: 'surface-1',
  surface2: 'surface-2',
  surface3: 'surface-3',
  overlay: 'overlay',
  border: 'border',
  borderStrong: 'border-strong',
  wash: 'wash',
  tint: 'tint',
  text: 'text',
  textMuted: 'text-muted',
  textDim: 'text-dim',
  accent: 'accent',
  accentHover: 'accent-hover',
  accentBright: 'accent-bright',
  accentInk: 'accent-ink',
  accentText: 'accent-text',
  accentWash: 'accent-wash',
  accentSoft: 'accent-soft',
  accentSoftHover: 'accent-soft-hover',
  success: 'success',
  info: 'info',
  hdr: 'hdr',
  h265: 'h265',
  danger: 'danger',
  dangerHover: 'danger-hover',
};

const SURFACES = [
  'bg',
  'surface1',
  'surface2',
  'surface3',
  'overlay',
  'border',
  'borderStrong',
  'wash',
  'tint',
] as const;
const TEXT = ['text', 'textMuted', 'textDim'] as const;
const ACCENT = [
  'accent',
  'accentHover',
  'accentBright',
  'accentInk',
  'accentText',
  'accentWash',
  'accentSoft',
  'accentSoftHover',
] as const;
const SEMANTIC = ['success', 'info', 'hdr', 'h265', 'danger', 'dangerHover'] as const;

const ALIASES = [
  '  --surface-page: var(--kroma-bg);',
  '  --surface-card: var(--kroma-surface-1);',
  '  --surface-raised: var(--kroma-surface-2);',
  '  --text-body: var(--kroma-text);',
  '  --text-secondary: var(--kroma-text-muted);',
  '  --text-tertiary: var(--kroma-text-dim);',
  '  --brand: var(--kroma-accent);',
  '  --brand-ink: var(--kroma-accent-ink);',
];

function paletteLines(p: Palette): string[] {
  const decl = (k: keyof typeof colors) => `  --kroma-${CSS_COLOR[k]}: ${p[k].toLowerCase()};`;
  return [
    '  /* Surfaces */',
    ...SURFACES.map(decl),
    ...section('Text'),
    ...TEXT.map(decl),
    ...section('Brand accent'),
    ...ACCENT.map(decl),
    ...section('Semantic + quality badges'),
    ...SEMANTIC.map(decl),
  ];
}

// A token added to colors.ts and forgotten here would silently never exist as a
// custom property.
function assertComplete(css: string): void {
  const missing = (Object.keys(colors) as (keyof typeof colors)[]).filter(
    (k) => !css.includes(`--kroma-${CSS_COLOR[k]}:`),
  );
  if (missing.length > 0) {
    throw new Error(
      `colors.ts declares ${missing.join(', ')} but the token CSS never emits it. ` +
        'Add it to the section it belongs to in gen-token-css.ts.',
    );
  }
}

const nest = (lines: string[]) => lines.map((l) => (l ? `  ${l}` : l)).join('\n');

function colorsCss(): string {
  const dark = [...paletteLines(colors), ...section('Semantic aliases'), ...ALIASES];
  const light = paletteLines(lightColors);
  return (
    `${block(dark)}\n` +
    `@media (prefers-color-scheme: light) {\n  :root:not([data-theme="dark"]) {\n${nest(light)}\n  }\n}\n\n` +
    `:root[data-theme="light"] {\n${light.join('\n')}\n}\n`
  );
}

function typographyCss(): string {
  const role = (s: (typeof typeSpec)[keyof typeof typeSpec]) =>
    `${s.weight} ${s.size}px / ${s.ratio} var(--font-${s.family})`;
  return block([
    '  /* Families: display grotesk for titles, humanist grotesk for UI */',
    `  --font-display: "${fonts.display}", system-ui, sans-serif;`,
    `  --font-ui: "${fonts.ui}", system-ui, sans-serif;`,
    ...section('Roles (font shorthand: weight size/line family)'),
    ...Object.entries(typeSpec).map(([k, v]) => `  --type-${kebab(k)}: ${role(v)};`),
    ...section('Tracking, in em. The overline roles are also text-transform:uppercase'),
    ...Object.entries(tracking).map(([k, v]) => `  --tracking-${kebab(k)}: ${v}em;`),
  ]);
}

function spacingCss(): string {
  return block([
    ...Object.entries(space).map(([k, v]) => `  --space-${k}: ${v}px;`),
    ...section('Layout gutters'),
    `  --gutter-web: ${gutter.web}px; /* desktop page side padding */`,
    `  --gutter-tv: ${gutter.tv}px; /* 10-foot side padding */`,
    `  --gutter-mobile: ${gutter.mobile}px;`,
    ...section('Component rhythm'),
    `  --row-gap: ${rhythm.rowGap}px; /* carousel card gap (web) */`,
    `  --card-w: ${rhythm.cardWidth}px; /* default poster width (web) */`,
  ]);
}

const RADIUS_NOTE: Partial<Record<keyof typeof radius, string>> = {
  md: 'buttons',
  lg: 'posters / cards',
  xl: 'large cards, rails',
  '2xl': 'panels, modals',
};

function effectsCss(): string {
  // Rings reference var(--kroma-accent) rather than the literal hex, so a themed
  // override of the accent still retints them.
  return block([
    '  /* Corner radii */',
    ...Object.entries(radius).map(([k, v]) => {
      const note = RADIUS_NOTE[k as keyof typeof radius];
      return `  --radius-${k}: ${v}px;${note ? ` /* ${note} */` : ''}`;
    }),
    ...section('Elevation'),
    ...Object.entries(shadow).map(([k, v]) => `  --shadow-${k}: ${v};`),
    ...section('Focus + glow (10-foot / TV)'),
    `  --ring-width: ${RING_WIDTH}px; /* one width for every focus visual */`,
    `  --ring-gap: ${RING_GAP}px; /* how far it stands off the control */`,
    `  --ring-outline: ${RING_WIDTH}px solid var(--kroma-accent);`,
    ...Object.entries(glow).map(([k, v]) => `  --glow-${k}: ${v};`),
    ...section('Motion'),
    `  --ease-out: ${bezier(motion.bezier.out)};`,
    `  --ease-spring: ${bezier(motion.bezier.spring)};`,
    ...Object.entries(motion.duration).map(([k, v]) => `  --dur-${k}: ${v / 1000}s;`),
    `  --press-scale: ${motion.pressScale}; /* buttons shrink on :active */`,
    `  --hover-lift: ${motion.focusLift}px; /* cards translateY on hover */`,
  ]);
}

/** Every design token as CSS custom properties, both palettes. */
export function tokensCss(): string {
  const body = [colorsCss(), typographyCss(), spacingCss(), effectsCss()].join('\n');
  assertComplete(body);
  return body;
}

const DIRECTIVE = /@kroma-tokens\s*;/g;

const expand = (code: string) => code.replace(DIRECTIVE, tokensCss());

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
 * Expands `@kroma-tokens;` into the design tokens, the way `@import "tailwindcss"`
 * expands into Tailwind.
 *
 * Two hooks, because Vite reaches a stylesheet two different ways. `transform`
 * catches the file an app imports from JS, which is where the directive belongs.
 * A stylesheet pulled in by a nested CSS `@import` never reaches the plugin
 * container at all - Vite inlines those inside its own CSS plugin - so
 * `generateBundle` sweeps the emitted assets and expands whatever the first hook
 * could not see. Without the second, the directive ships verbatim and every
 * custom property is silently missing.
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
        if (typeof file.source !== 'string' || !file.source.includes('@kroma-tokens')) continue;
        file.source = expand(file.source);
      }
    },
  };
}
