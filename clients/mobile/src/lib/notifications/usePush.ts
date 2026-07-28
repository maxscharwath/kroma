// Mounting native push in the app: how an arriving notification behaves, and
// where a tap goes.
//
// This runs at the ROOT, so it must survive a build with no native push module
// (see `./native`). Nothing here imports `expo-notifications` at module scope
// and nothing runs at import time — an older dev client loses push, not the app.
//
// Kept apart from `./push` (which owns permission and registration) because this
// half runs unconditionally while that half only runs on a button press.

import type * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '#mobile/lib/session';

import { push as loadPush } from './native';
import { handleTap } from './taps';

/**
 * Route taps on pushes. Mounted once, near the root, alongside the in-app
 * notification stream.
 *
 * Covers both entry points: a tap while the app is running, and the tap that
 * launched it from cold (`getLastNotificationResponseAsync`) — miss the second
 * and a notification opened from a killed app lands on the home screen instead
 * of the film it was about.
 */
export function usePushTaps(): void {
  const { status, client } = useSession();
  const router = useRouter();
  const signedIn = status === 'signedIn';

  useEffect(() => {
    if (!signedIn || !client) return;
    let cancelled = false;
    let subscription: { remove(): void } | undefined;

    void (async () => {
      const push = await loadPush();
      // No native push in this build: the in-app centre still works.
      if (!push || cancelled) return;

      // A push that arrives while the app is open should still be seen: the
      // bell updates from the socket, but the user may be three screens deep.
      // Banner only — no sound, since the app is already in hand.
      push.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: true,
        }),
      });

      const go = async (response: Notifications.NotificationResponse) => {
        const route = await handleTap(response, client);
        // Guards a sign-out landing between the await and the push.
        if (route && !cancelled) router.push(route as never);
      };

      // The tap that cold-started the app, if any.
      const initial = await push.getLastNotificationResponseAsync();
      if (initial && !cancelled) await go(initial);
      if (cancelled) return;

      subscription = push.addNotificationResponseReceivedListener((response) => {
        void go(response);
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [signedIn, client, router]);
}
