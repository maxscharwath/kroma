// The native TV app: the SAME @kroma/tv experience the Tizen, webOS, Android TV
// and desktop shells mount, compiled by React Native instead of rendered in a
// WebView.
//
// A shell is deliberately thin. Everything above this file is shared: the
// screens, the design system, the focus engine, the API client. What a shell
// owns is the platform's boot sequence (fonts, splash, keep-awake) and the
// stage the app is laid out on.

import { setSearchShell, setVoiceSearchBackend, TvApp } from '@kroma/tv';
import { TvStage } from '@kroma/ui/kit';
import { useFonts } from 'expo-font';
import { useKeepAwake } from 'expo-keep-awake';
import { LogBox } from 'react-native';

LogBox.ignoreAllLogs(true);

import { useEffect, useState } from 'react';
import { nativeSearchShell } from './lib/native-search';
import { startSiriSearch } from './lib/siri-search';
import { hydrateSessionStorage } from './lib/storage';
import { nativeVoiceSearch } from './lib/voice-search';

// Speaking a search is the one capability the shared app cannot implement for
// itself: the microphone belongs to the platform (see the module). Registered at
// module scope, before the first render, exactly like the image backend.
setVoiceSearchBackend(nativeVoiceSearch);
// And on Apple TV the keyboard belongs to the platform too, because that is the
// only keyboard the Siri Remote will dictate into (see the module).
setSearchShell(nativeSearchShell);

/** The design's two families, from the design system's own asset folder (the
 * same files the server rasterises share cards with). On the browser targets
 * they arrive through a <link> to Google Fonts; here they are bundled, so the
 * lockup and the type render identically on a TV that has no network yet. */
const FONTS = {
  'Bricolage Grotesque': require('@kroma/ui/src/assets/fonts/BricolageGrotesque-ExtraBold.ttf'),
  'Hanken Grotesk': require('@kroma/ui/src/assets/fonts/HankenGrotesk.ttf'),
};

export function App() {
  // A TV must never sleep mid-film, and unlike a phone there is no user
  // interaction to keep it awake.
  useKeepAwake();
  // The stored session has to be in memory BEFORE the app renders: it seeds
  // React state during the first render, so a session that arrives later is a
  // profile picker the user has already been shown.
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    void hydrateSessionStorage().finally(() => setSessionReady(true));
  }, []);
  // Siri is the Apple TV's voice input (the remote's microphone is the system's
  // and no app may open it): a request spoken to it lands on the search screen.
  useEffect(startSiriSearch, []);
  // Render on FAILURE as well as on success. A missing font is a cosmetic
  // problem; blocking on it renders nothing at all, and on a television that is
  // indistinguishable from a frozen app, with no way to find out why.
  const [fontsLoaded, fontError] = useFonts(FONTS);
  if (!sessionReady) return null;
  if (!fontsLoaded && !fontError) return null;
  // No <StatusBar>: a TV has none. tvOS does not even ship the native module
  // behind it, so asking to hide a status bar throws ("undefined is not a
  // function" out of NativeStatusBarManagerIOS) rather than being a no-op.
  return (
    <TvStage>
      <TvApp platform="AppleTV" />
    </TvStage>
  );
}
