// Typed text. In CSS, `body { color; font-family }` cascades into every
// descendant; in React Native it does NOT, so a bare <Text> would render as
// black 14px system font. Every string in the app goes through this component,
// which resolves a design type role and a palette colour.

import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { color as resolveColor } from '../system/boxStyle';
import { type ColorToken, type TypeRole, type as typeRoles } from '../tokens';

export interface TxtProps extends Omit<TextProps, 'style' | 'role'> {
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

export function Txt({
  variant = 'body',
  color = 'text',
  style,
  lines,
  ...rest
}: Readonly<TxtProps>) {
  return (
    <RNText
      {...rest}
      numberOfLines={lines}
      style={[typeRoles[variant], { color: resolveColor(color) }, style]}
    />
  );
}
