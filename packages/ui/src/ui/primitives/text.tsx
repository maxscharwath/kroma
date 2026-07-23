// Typed text. In CSS, `body { color; font-family }` cascades into every
// descendant; in React Native it does NOT, so a bare <Text> would render as
// black 14px system font. Every string in the app goes through this component,
// which resolves a design type role and a palette colour.

import {
  Text as RNText,
  type StyleProp,
  StyleSheet,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { color as resolveColor } from '../../lib/box-style';
import { type ColorToken, type TypeRole, type as typeRoles, typeSpec } from '../../lib/tokens';

interface TxtProps extends Omit<TextProps, 'style' | 'role'> {
  /** Design type role. Defaults to `body`. (Named `variant`, not `role`, which
   *  React Native already uses for the ARIA role.) */
  variant?: TypeRole;
  /** Palette token, or any raw colour string for a one-off (the design uses a
   *  few literal rgba washes that are not tokens). Defaults to `text`. */
  color?: ColorToken | (string & {});
  /** Escape hatch for one-off sizing/weight, merged last. */
  style?: StyleProp<TextStyle>;
  /** Clamp to N lines with an ellipsis (the RN spelling of line-clamp). */
  lines?: number;
}

/**
 * A `style` that resizes the text without restating `lineHeight` would keep the
 * role's absolute one, which is sized for the role's own font size. Web only
 * spills the glyph out of that line box, but native React Native CLIPS it (the
 * PIN keypad's 28px digits lost their tops to `body`'s 25px line). Re-derive the
 * line height from the role's authored ratio so the override stays proportional.
 */
function lineFix(variant: TypeRole, style: StyleProp<TextStyle>): TextStyle | null {
  if (!style) return null;
  const flat = StyleSheet.flatten(style);
  const size = flat?.fontSize;
  const spec = typeSpec[variant];
  if (typeof size !== 'number' || size === spec.size) return null;
  return flat.lineHeight === undefined ? { lineHeight: Math.round(size * spec.ratio) } : null;
}

function Txt({ variant = 'body', color = 'text', style, lines, ...rest }: Readonly<TxtProps>) {
  return (
    <RNText
      {...rest}
      numberOfLines={lines}
      style={[typeRoles[variant], { color: resolveColor(color) }, style, lineFix(variant, style)]}
    />
  );
}

export type { TxtProps };
export { Txt };
