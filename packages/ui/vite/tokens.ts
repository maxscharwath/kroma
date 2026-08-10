// The design system as CSS. A stylesheet writes `@import "@kroma/ui"` for the
// lot, or `@kroma/ui/tokens` / `@kroma/ui/theme` for one half.

import { fileURLToPath } from 'node:url';
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
export function tokensCss(): string {
  return [
    rule(':root', [...palette(colors), ...ALIASES, ...typography(), ...spacing(), ...effects()]),
    rule(':root[data-theme="light"]', palette(lightColors)),
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
  return Object.values(fonts)
    .flatMap((family) =>
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
    )
    .join('\n\n');
}

/** Keyframes the components animate with, on every browser target. */
export function motionCss(): string {
  return [
    // The <Img> reveal. A rule rather than an opacity driven from React: the
    // element's resting state has to be VISIBLE, or art that is already decoded
    // stays invisible when the state that would reveal it never arrives.
    '@keyframes kroma-img-in {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}',
    '@keyframes kroma-breathe {\n  0%, 100% { opacity: 0.45; }\n  50% { opacity: 0.85; }\n}',
    '@keyframes fade-in {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}',
    '@keyframes pop-in {\n  from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }\n  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }\n}',
  ].join('\n\n');
}

/** The reset and page furniture a browser target wants. A TV shell supplies its
 *  own (it hides overflow and owns its focus visuals), so this is not in the
 *  `tokens` half every target shares. */
export function baseCss(): string {
  return [
    '*, *::before, *::after { box-sizing: border-box; }',
    'html, body, #root { height: 100%; }',
    rule('body', [
      'margin: 0;',
      'background: var(--kroma-bg);',
      'color: var(--kroma-text);',
      'font: var(--type-body);',
      '-webkit-font-smoothing: antialiased;',
      'text-rendering: optimizeLegibility;',
      'overflow-x: hidden;',
    ]),
    rule('::selection', ['background: var(--kroma-accent-soft);', 'color: var(--kroma-text);']),
    'a { color: inherit; text-decoration: none; }',
    'button { font-family: var(--font-ui); }',
    // The ring is an outline standing off the control, so it already takes the
    // control's corners: this must never set border-radius.
    rule(':focus-visible', ['outline: var(--ring-outline);', 'outline-offset: var(--ring-gap);']),
    // Except inside a field, where <TextField> owns the focus visual.
    'input:focus-visible, textarea:focus-visible { box-shadow: none; }',
    rule('.kroma-overline', [
      'font: var(--type-overline);',
      'letter-spacing: var(--tracking-overline);',
      'text-transform: uppercase;',
      'color: var(--kroma-text-muted);',
    ]),
    // Off-screen tiles skip layout and paint until they near the viewport while
    // staying in the DOM, so remote focus can still reach them.
    rule('.kroma-poster', ['content-visibility: auto;', 'contain-intrinsic-size: 200px 320px;']),
    // Fluid, unlayered so they beat the token defaults, which are TV constants.
    rule(':root', [
      '--gutter-web: clamp(1rem, 4vw, 3.5rem);',
      '--card-w: clamp(8.25rem, 30vw, 13rem);',
    ]),
    rule('*', [
      'scrollbar-color: var(--kroma-border-strong) transparent;',
      'scrollbar-width: thin;',
    ]),
    '::-webkit-scrollbar { width: 10px; height: 10px; }',
    '::-webkit-scrollbar-track { background: transparent; }',
    rule('::-webkit-scrollbar-thumb', [
      'background-clip: padding-box;',
      'border: 3px solid transparent;',
      'border-radius: 999px;',
      'background-color: var(--kroma-border-strong);',
    ]),
    '::-webkit-scrollbar-thumb:hover { background-color: var(--kroma-text-dim); }',
    '::-webkit-scrollbar-corner { background: transparent; }',
  ].join('\n\n');
}

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
