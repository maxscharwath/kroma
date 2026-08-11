import type { ReactNode } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Box } from '#ui/components/atoms/box';

export interface GroundProps {
  /** The ground this subtree paints on, whatever the page around it chose. */
  tone: 'dark' | 'light';
  flex?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Pins a subtree to one ground.
 *
 * The player is why this exists: its chrome sits over video, so it is dark on a
 * page that is light, and a control that followed the page would put light ink
 * on a black scrim. Anything painting over artwork wants the same.
 *
 * On a browser this is a true scope, and one attribute. Every colour the kit
 * compiles is a custom property, so `[data-theme]` on this element redefines
 * them for everything inside it: no re-render, no second stylesheet, and the
 * classes are the ones already on the page.
 *
 * ON NATIVE IT DOES NOTHING, and that is deliberate. There is no cascade to
 * redefine and the theme store is ONE switch, so the only way to honour `tone`
 * would be to move the whole app's ground, which is not a scope and does not
 * survive contact with a remount: driving the store from a subtree's effect
 * bumps the version, the version remounts the subtree, and the effect runs
 * again. A surface that has to hold one ground on a phone spells its own inks
 * instead, the way anything painting over artwork already has to.
 */
export function Ground({ tone, flex, style, children }: Readonly<GroundProps>) {
  return (
    <Box flex={flex} style={style} dataSet={WEB ? { theme: tone } : undefined}>
      {children}
    </Box>
  );
}

const WEB = Platform.OS === 'web';
