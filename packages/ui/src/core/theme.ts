// The theme: every token group behind one live store, and KROMA as the default.
//
// A theme is a plain object. `createTheme` deep-merges overrides over a base and
// re-derives the bundles that follow from other groups — the finished type roles
// from `typeSpec` + `fonts`, the focus ring from the accent — so overriding one
// side updates everything built on it. `setTheme` swaps the active theme and
// bumps a version; recipes, `styles()` and <Box> all check that version and
// re-resolve lazily on their next use, so a switch costs one rebuild per recipe
// actually rendered, not an eager sweep.
//
// Adding a token GROUP is adding a key to `ThemeTokens` and a base value below.
// Adding a NAME to a group is a registry augmentation (see `ColorRegistry`) plus
// the value in `createTheme` — the name is then typed everywhere the vocabulary
// reaches.

import type { TextStyle } from 'react-native';
import { webDocument } from '#ui/lib/dom';
import { type ColorToken, colors, lightColors, withAlpha } from './tokens/colors';
import { CSS_COLORS, CSS_SHADOWS } from './tokens/css-palette';
import { cssVar } from './tokens/css-var';
import {
  lightShadow,
  motion,
  type RingStyle,
  type ShadowToken,
  shadow,
  standoff,
  standoffInside,
  WASH_ALPHA,
} from './tokens/effects';
import {
  CIRCLE_RADIUS,
  type CornerValue,
  gutter,
  type RadiusToken,
  radius,
  rhythm,
  space,
} from './tokens/layout';
import {
  type FontToken,
  fonts,
  type TypeRole,
  type TypeSpec,
  toType,
  tracking,
  typeSpec,
} from './tokens/typography';

/** The token modules author values `as const`; a theme's slots take any value
 *  of the same shape, not only the KROMA literal. */
type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : { [K in keyof T]: Widen<T[K]> };

export interface ThemeTokens {
  colors: Record<ColorToken, string>;
  radius: Record<RadiusToken, number>;
  shadow: Record<ShadowToken, string>;
  fonts: Record<FontToken, string>;
  typeSpec: Record<TypeRole, TypeSpec>;
  motion: Widen<typeof motion>;
  gutter: Widen<typeof gutter>;
  space: Widen<typeof space>;
  rhythm: Widen<typeof rhythm>;
  tracking: Widen<typeof tracking>;
}

const GROUPS: readonly (keyof ThemeTokens)[] = [
  'colors',
  'radius',
  'shadow',
  'fonts',
  'typeSpec',
  'motion',
  'gutter',
  'space',
  'rhythm',
  'tracking',
];

export interface Theme extends ThemeTokens {
  /** Derived from `typeSpec` + `fonts`; never authored directly. */
  type: Record<TypeRole, TextStyle>;
  /** Derived from the accent; never authored directly. The glow pairs carry the
   *  accent bloom the player's focus treatment adds to the plain ring. */
  ring: {
    focus: RingStyle;
    focusSm: RingStyle;
    focusLift: RingStyle;
    focusGlow: RingStyle;
    focusGlowSm: RingStyle;
    /** The soft wide wash, for a control whose focus must read as a glow on a
     *  thin shape (the seek bar's track) rather than a crisp outline. */
    focusWash: RingStyle;
    /** The ring, inward: for a control flush with whatever clips it. */
    focusInset: RingStyle;
  };
  /** Derived from the accent wash; never authored directly. */
  glow: { accent: string; play: string };
}

/** What the `ring:` shorthand accepts. */
export type RingToken = keyof Theme['ring'];

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

/** What `createTheme` accepts: any slice of any group. A name the base does not
 *  have needs its registry augmented first, which is what keeps it typed at
 *  every use site rather than only here. */
export type ThemeOverrides = { [G in keyof ThemeTokens]?: DeepPartial<ThemeTokens[G]> };

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function merge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (over === undefined) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(over as Record<string, unknown>)) {
    if (value === undefined) continue;
    const under = out[key];
    out[key] = isPlain(value) && isPlain(under) ? merge(under, value) : value;
  }
  return out as T;
}

// A token still holding its built-in value is one the cascade may own, so on a
// browser it resolves to its custom property and one compiled class paints on
// either ground. An override is a decision the cascade knows nothing about.
function paint<K extends string>(
  group: Record<K, string>,
  builtin: Record<K, string>,
  vars: Readonly<Record<string, string>> | null,
): Record<K, string> {
  if (!vars) return group;
  const out = {} as Record<K, string>;
  for (const key of Object.keys(group) as K[]) {
    out[key] = group[key] === builtin[key] ? (vars[key] ?? group[key]) : group[key];
  }
  return out;
}

function derive(base: ThemeTokens): Theme {
  const tokens: ThemeTokens = {
    ...base,
    colors: paint(base.colors, colors, CSS_COLORS),
    shadow: paint(base.shadow, shadow, CSS_SHADOWS),
  };
  const accent = tokens.colors.accent;
  const glow = {
    accent: `0 6px 22px ${withAlpha(tokens.colors.accentWash, WASH_ALPHA.glow / 100)}`,
    play: `0 6px 22px ${withAlpha(tokens.colors.accentWash, WASH_ALPHA.play / 100)}`,
  };
  return Object.freeze({
    ...tokens,
    type: toType(tokens.typeSpec, tokens.fonts) as Record<TypeRole, TextStyle>,
    // Every ring is one width standing one gap off the control (see
    // tokens/effects): a themed accent retints them, it does not get to
    // re-decide how thick focus is or how far off it sits.
    ring: {
      focus: standoff(accent),
      focusSm: standoff(accent),
      // The theme's own elevation, not a literal: a black drop shadow tuned for
      // charcoal is a smear under a control on paper.
      focusLift: standoff(accent, tokens.shadow.pop),
      focusGlow: standoff(accent, glow.accent),
      focusGlowSm: standoff(accent, glow.accent),
      focusWash: standoff(withAlpha(tokens.colors.accentWash, WASH_ALPHA.ring / 100)),
      focusInset: standoffInside(accent),
    },
    glow,
  });
}

/** The default theme, straight from the token modules. */
export const KROMA: Theme = derive({
  colors,
  radius,
  shadow,
  fonts,
  typeSpec,
  motion,
  gutter,
  space,
  rhythm,
  tracking,
});

/** KROMA on a warm paper ground. */
export const KROMA_LIGHT: Theme = derive({
  colors: lightColors,
  radius,
  shadow: lightShadow,
  fonts,
  typeSpec,
  motion,
  gutter,
  space,
  rhythm,
  tracking,
});

export function createTheme(overrides: ThemeOverrides, base: Theme = KROMA): Theme {
  const groups: Record<string, unknown> = {};
  for (const key of GROUPS) groups[key] = merge(base[key], overrides[key]);
  return derive(groups as unknown as ThemeTokens);
}

let active: Theme = KROMA;
// Starts at 1 so a consumer can use 0 (or -1) as "never resolved".
let version = 1;
const listeners = new Set<() => void>();

export function activeTheme(): Theme {
  return active;
}

/**
 * A corner in px, from the name the design speaks it in. For the handful of
 * places that need the NUMBER rather than a style declaration — a <Frost> layer
 * clipping itself, a corner nested inside another, an animated value — so they
 * follow a theme's corner language instead of freezing the default scale.
 *
 * `side` is the box's own side, and only `'circle'` reads it: a disc is half of
 * itself, so it resolves without the theme and no theme can flatten it.
 */
export function radiusValue(corner: CornerValue, side?: number): number {
  if (typeof corner === 'number') return corner;
  if (corner === 'circle') return side === undefined ? CIRCLE_RADIUS : side / 2;
  return active.radius[corner];
}

/** Monotonic; bumped by every `setTheme`. Anything that caches resolved styles
 *  keys on it (see recipe.ts, styles.ts, box-style.ts). */
export function themeVersion(): number {
  return version;
}

// The page furniture is authored CSS reading these properties, so a theme set
// in JavaScript has to reach the cascade or the ground stays on `data-theme`'s.
// A token the theme left alone still resolves to its own property (see `paint`),
// which is why releasing it beats writing it back as a self-reference.
function publish(theme: Theme): void {
  const root = webDocument()?.documentElement;
  if (!root) return;
  const write = (name: string, value: string) => {
    if (value.startsWith('var(')) root.style.removeProperty(name);
    else root.style.setProperty(name, value);
  };
  for (const [token, value] of Object.entries(theme.colors)) write(cssVar(token), value);
  for (const [token, value] of Object.entries(theme.shadow)) write(`--shadow-${token}`, value);
}

export function setTheme(theme: Theme): void {
  if (theme === active) return;
  active = theme;
  version += 1;
  publish(theme);
  for (const listener of listeners) listener();
}

/** Subscribe to theme swaps; returns the unsubscribe. Shaped for
 *  `useSyncExternalStore`, which is exactly what `useTheme` feeds it to. */
export function onThemeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * A value derived from the theme, memoised per swap: call the returned function
 * at use time and it recomputes only when the theme has changed. This is how a
 * module holds something theme-flavoured (a gradient string, a paint bundle)
 * without freezing it to the palette of module-load time.
 */
export function themed<T>(make: (theme: Theme) => T): () => T {
  let at = -1;
  let value: T;
  return () => {
    if (at !== version) {
      value = make(active);
      at = version;
    }
    return value;
  };
}
