import { type ReactNode, useEffect } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { activeTheme, KROMA, KROMA_LIGHT, setTheme } from '#ui/core';
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
 * On a browser this is one attribute and a true scope. Every colour the kit
 * compiles is a custom property, so `[data-theme]` on this element redefines
 * them for everything inside it: no re-render, no second stylesheet, and the
 * classes are the ones already on the page.
 *
 * React Native has no cascade and the theme store is ONE switch, so there is
 * nothing to scope to: on a native target this moves the whole app's ground and
 * puts it back on unmount. That is only honest for a subtree that fills the
 * screen while it is up, which is what the player is. Do not reach for it to
 * pin a panel sitting inside a page.
 */
export function Ground(props: Readonly<GroundProps>) {
  return Platform.OS === 'web' ? <WebGround {...props} /> : <NativeGround {...props} />;
}

function WebGround({ tone, flex, style, children }: Readonly<GroundProps>) {
  return (
    <Box flex={flex} style={style} dataSet={{ theme: tone }}>
      {children}
    </Box>
  );
}

function NativeGround({ tone, flex, style, children }: Readonly<GroundProps>) {
  useEffect(() => {
    const before = activeTheme();
    setTheme(tone === 'light' ? KROMA_LIGHT : KROMA);
    return () => setTheme(before);
  }, [tone]);
  return (
    <ThemeProvider>
      <Box flex={flex} style={style}>
        {children}
      </Box>
    </ThemeProvider>
  );
}
