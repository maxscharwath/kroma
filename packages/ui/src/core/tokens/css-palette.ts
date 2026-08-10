// ONE file keyed on Platform.OS, deliberately not a `.ts`/`.web.ts` pair: the
// native half is `null`, a legal value, so an import that resolved past the
// platform file would not fail. It would quietly repaint the whole system in
// literals and show two themes at once.

import { Platform } from 'react-native';
import { colors, splitAlpha } from './colors';
import { cssVar } from './css-var';
import { shadow } from './effects';

const WEB = Platform.OS === 'web';

const vars = (group: object, name: (key: string) => string): Readonly<Record<string, string>> =>
  Object.freeze(Object.fromEntries(Object.keys(group).map((k) => [k, `var(${name(k)})`])));

/**
 * The palette as CSS custom properties, or null where there is no cascade.
 *
 * A browser resolves every token the app has not overridden to its property
 * rather than to a hex, which is what makes the design system's two halves one:
 * `[data-theme="light"]` redefines the properties and the page repaints, with no
 * re-render, no second stylesheet, and one atomic class serving both grounds.
 * React Native has nowhere to redefine a value, so there the palette stays
 * literal and the theme store is what moves.
 */
export const CSS_COLORS: Readonly<Record<string, string>> | null = WEB
  ? vars(colors, cssVar)
  : null;

export const CSS_SHADOWS: Readonly<Record<string, string>> | null = WEB
  ? vars(shadow, (k) => `--shadow-${k}`)
  : null;

/**
 * The translucent tokens, as the two properties the build emits for each.
 *
 * A glyph is stroked path by path, so it has to be painted opaque and faded
 * whole. Neither half can be a number here: a token's alpha is not the same on
 * both grounds, so the value has to stay in the cascade.
 */
export const CSS_FADED: Readonly<Record<string, { color: string; opacity: string }>> = WEB
  ? Object.freeze(
      Object.fromEntries(
        Object.entries(colors)
          .filter(([, value]) => splitAlpha(value).opacity < 1)
          .map(([token]) => [
            token,
            { color: `var(${cssVar(token)}-opaque)`, opacity: `var(${cssVar(token)}-alpha)` },
          ]),
      ),
    )
  : {};
