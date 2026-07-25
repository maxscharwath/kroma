// The kit app: the same workbench the site serves, compiled by React Native.
//
// It exists so that "inspect the kit on the device that actually has to display
// it" is its OWN app rather than a branch inside every product shell. The TV
// client used to carry the whole design system behind an env flag purely to
// offer this; now it carries the product and nothing else, and this is what you
// launch at a simulator.
//
// One app, both shapes. `Platform.isTV` is a build-time fact on the tvOS fork
// (the same bundle is never both), so this is a fork in the shell rather than a
// runtime feature check:
//
//   television  the workbench sits on <TvStage>, the fixed 1920x1080 canvas
//               every 10-foot screen is authored against - so the kit is being
//               judged at the size and distance it ships at.
//   phone       no stage: the point of the phone build is the REAL point grid,
//               where a 44pt hit target is 44pt.

import { TvStage } from '@kroma/ui/kit';
import { useFonts } from 'expo-font';
import { useKeepAwake } from 'expo-keep-awake';
import type { ReactNode } from 'react';
import { LogBox, Platform } from 'react-native';
import { Kit } from './config';

LogBox.ignoreAllLogs(true);

/** The design's two families, from the design system's own asset folder. On the
 * site they arrive through a <link> to Google Fonts; here they are bundled, so
 * the type renders identically on a device with no network. */
const FONTS = {
  'Bricolage Grotesque': require('@kroma/ui/src/assets/fonts/BricolageGrotesque-ExtraBold.ttf'),
  'Hanken Grotesk': require('@kroma/ui/src/assets/fonts/HankenGrotesk.ttf'),
};

function Stage({ children }: Readonly<{ children: ReactNode }>) {
  return Platform.isTV ? <TvStage>{children}</TvStage> : children;
}

export function App() {
  // Reading a component's props is not interacting with the app, and a TV with
  // nothing to click has no reason to think you have left.
  useKeepAwake();
  // Render on FAILURE as well as on success. A missing font is a cosmetic
  // problem; blocking on it renders nothing at all, and on a television that is
  // indistinguishable from a frozen app with no way to find out why.
  const [fontsLoaded, fontError] = useFonts(FONTS);
  if (!fontsLoaded && !fontError) return null;
  return (
    <Stage>
      <Kit />
    </Stage>
  );
}
