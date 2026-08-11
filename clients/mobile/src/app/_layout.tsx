import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { lanBeacon } from '@kroma/lan-beacon';
import { CastProvider, I18nProvider as KitI18nProvider } from '@kroma/ui';
import {
  applyMode,
  readMode,
  registerFrost,
  setEntryDefaults,
  setImageBackend,
  setTheme,
  styles,
  ThemeProvider,
  useSystemGround,
  useTheme,
} from '@kroma/ui/kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import * as Device from 'expo-device';
import { Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { installDeviceStore } from '#mobile/lib/deviceStore';
import { DownloadsProvider } from '#mobile/lib/downloads';
import { I18nProvider, useI18n } from '#mobile/lib/i18n';
import { expoImageBackend } from '#mobile/lib/image-backend';
import { isTablet } from '#mobile/lib/layout';
import { useNotificationStream } from '#mobile/lib/notifications';
import { usePushGrantRefresh, usePushLabels, usePushTaps } from '#mobile/lib/notifications/usePush';
import { SessionProvider, useSession } from '#mobile/lib/session';
import { MOBILE, MOBILE_LIGHT, mobileTheme } from '#mobile/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Every per-device choice the design system persists goes through this store,
// and the theme mode is read one statement below.
installDeviceStore();

// The design system draws artwork through whichever decoder the app registers.
// A phone wants expo-image's memory + disk cache; see lib/image-backend.
setImageBackend(expoImageBackend);

// Same inversion for glass: <Frost> has no blur of its own, so a shell that
// registers nothing leaves every frosted surface a flat wash (see <Frost>).
registerFrost(BlurView);

// This app's form factor, stated once (see lib/field-shell). A phone HAS a
// keyboard: tapping a field must focus a real entry and summon the IME. The
// kit defaults to the 10-foot behaviour, where a field is a read-only value
// with a caret and typing arrives from the on-screen keyboard instead.
setEntryDefaults({ physicalKeyboard: true, size: 'md' });

// And the same statement for the rest of the vocabulary: the phone's type ramp,
// corners and spacing, so a kit component here is sized for a hand rather than
// for a room. Module scope, before the first render - a swap after one is legal
// (every recipe re-resolves lazily) but would repaint the whole tree.
//
// The ground comes first, so a returning user opens on the mode they chose
// rather than on the default one, and the form factor is then re-stated over
// whichever base `applyMode` picked.
applyMode(readMode());
setTheme(mobileTheme());

function KitI18nBridge({ children }: Readonly<{ children: ReactNode }>) {
  return <KitI18nProvider locale={useI18n().locale}>{children}</KitI18nProvider>;
}

// Renders nothing - it is a subscription, not a piece of the interface.
function NotificationStream() {
  useNotificationStream();
  // Taps on NATIVE pushes route from here too: the socket handles the app while
  // it is open, this handles the notification that opened it.
  usePushTaps();
  // And the buttons iOS/Android draw ON those pushes are registered from here,
  // in the app's language, whenever that language changes.
  usePushLabels();
  // The relay grant a server holds expires, and only this app can replace one -
  // so a launch is the only chance to do it before push goes quiet.
  usePushGrantRefresh();
  return null;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, gcTime: 30 * 60_000, retry: 1 },
    },
  });
}

function Shell() {
  const { status, user, client } = useSession();
  // Two surfaces paint over something dark that is not the page, and hold the
  // dark ground whatever the phone chose: the gate, which is composed over a
  // full-bleed still, and the player, whose chrome sits on video. On paper
  // their ink would land on the artwork and disappear.
  //
  // Decided here rather than by the subtree itself. There is one theme store on
  // a native target, so a component that drove it from an effect would bump the
  // version, the version would remount it, and the effect would run again.
  const route = useSegments().join('/');
  const overArtwork = status !== 'signedIn' || route.includes('player');
  const ground = useTheme();
  const theme = overArtwork ? MOBILE : mobileTheme(ground);
  // The store moved to get here, so the stored mode is re-derived on the way out.
  useEffect(() => {
    if (!overArtwork) applyMode(readMode());
  }, [overArtwork]);
  // One cache per signed-in account: switching users drops everything.
  const [clients] = useState(() => new Map<string, QueryClient>());
  const cacheKey = user?.id ?? 'anon';
  let queryClient = clients.get(cacheKey);
  if (!queryClient) {
    queryClient = makeQueryClient();
    clients.clear();
    clients.set(cacheKey, queryClient);
  }

  useEffect(() => {
    if (status !== 'booting') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <KitI18nBridge>
          <DownloadsProvider client={client}>
            {/* Which TV this phone is driving is app-wide: the button on a
                detail page, the bar above the tabs and the remote screen are
                three views of one session. */}
            <CastProvider
              client={client}
              enabled={status === 'signedIn'}
              deviceName={Device.modelName ?? (Platform.OS === 'ios' ? 'iPhone' : 'Android')}
              lan={lanBeacon ?? undefined}
            >
              <NotificationStream />
              <BottomSheetModalProvider>
                {/* Innermost on purpose: a theme swap REMOUNTS this subtree
                    (see <ThemeProvider>), so the session, the query cache, the
                    locale, the downloads and the cast session all sit above it
                    and only the screens are drawn again. */}
                <ThemeProvider theme={theme}>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: theme.colors.bg },
                      animation: 'fade',
                      // Phones are portrait-only outside the player (which sets
                      // its own landscape lock in (app)/_layout); tablets rotate
                      // freely.
                      orientation: isTablet ? 'default' : 'portrait',
                    }}
                  />
                </ThemeProvider>
              </BottomSheetModalProvider>
            </CastProvider>
          </DownloadsProvider>
        </KitI18nBridge>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  useSystemGround();
  // Above the provider, so the root ground and the system bar follow a swap by
  // re-rendering rather than by remounting the session under them.
  const paper = mobileTheme(useTheme()) === MOBILE_LIGHT;
  return (
    <GestureHandlerRootView style={s.root}>
      <SessionProvider>
        <StatusBar style={paper ? 'dark' : 'light'} />
        <Shell />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

const s = styles({ root: { flex: true, bg: 'bg' } });
