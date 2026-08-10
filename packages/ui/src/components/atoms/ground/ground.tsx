import type { ReactNode } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { KROMA, KROMA_LIGHT } from '#ui/core';
import { ThemeProvider } from '#ui/core/use-theme';

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
 * On a browser this is one attribute. Every colour the kit compiles is a custom
 * property, so `[data-theme]` on this element redefines them for everything
 * inside it: no re-render, no second stylesheet, and the classes are the ones
 * already on the page. React Native has no cascade, so there the theme store is
 * swapped for the subtree instead.
 */
export function Ground({ tone, flex, style, children }: Readonly<GroundProps>) {
  if (Platform.OS === 'web') {
    return (
      <Box flex={flex} style={style} dataSet={{ theme: tone }}>
        {children}
      </Box>
    );
  }
  return (
    <ThemeProvider theme={tone === 'light' ? KROMA_LIGHT : KROMA}>
      <Box flex={flex} style={style}>
        {children}
      </Box>
    </ThemeProvider>
  );
}
