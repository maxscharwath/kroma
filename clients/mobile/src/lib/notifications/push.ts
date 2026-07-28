// This phone's push capability.
//
// Only what is genuinely native: whether the binary can do push at all, the
// permission prompt, the device token, and the action sets / channels the system
// needs registered up front. The flow around it — check, then prompt, then
// register with the server — is shared with the web client in `@kroma/core`'s
// `enablePush` / `disablePush`.
//
// The token is the RAW APNs/FCM one (`getDevicePushTokenAsync`), not an Expo
// push token: KROMA servers are self-hosted and talk to Apple and Google
// directly, so nothing is relayed through expo.dev and no Expo project exists.
//
// Note what is NOT here: rendering. When a push arrives the system draws it, and
// the in-app centre (`./index`) is the source of truth for the list — a push is
// a nudge toward a row that already exists on the server.

import type { PushBlocker, PushCapability, SubscribeBody } from '@kroma/core';
import * as Device from 'expo-device';
// Type-only: erased at build time, so it never pulls the native module in.
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

import { push as loadPush } from './native';

/**
 * The action sets the server may name in `push_category`.
 *
 * APNs and Android cannot carry arbitrary buttons: they can only display
 * actions belonging to a category the app registered up front. So this list is
 * the contract — the server picks a name from it, and the buttons come from
 * here. Adding one means adding it on both sides (`kroma-domain`'s
 * `PushCategory`).
 */
const CATEGORIES = {
  /** A moderator can approve or deny without opening the app. */
  request_review: [
    { identifier: 'approve', buttonTitle: 'Approve', options: { opensAppToForeground: false } },
    { identifier: 'deny', buttonTitle: 'Deny', options: { opensAppToForeground: false } },
  ],
  /** Something the user asked for is ready. */
  media_available: [
    { identifier: 'watch', buttonTitle: 'Watch', options: { opensAppToForeground: true } },
  ],
} as const;

/** Which service issued this device's token, and therefore how to reach it. */
function transportFor(type: string): SubscribeBody['transport'] | null {
  if (type === 'ios') return 'apns';
  if (type === 'android') return 'fcm';
  return null;
}

/** Register the categories whose buttons the server may ask for. */
export async function registerCategories(): Promise<void> {
  const Notifications = await loadPush();
  if (!Notifications) return;
  await Promise.all(
    Object.entries(CATEGORIES).map(([name, actions]) =>
      Notifications.setNotificationCategoryAsync(name, [...actions]),
    ),
  );
}

/**
 * Android requires every notification to name a channel, and the channel — not
 * the payload — owns the importance and the sound. One per category the server
 * sends, so a user can silence "new titles" in the system settings while
 * keeping "your request is ready" loud.
 */
export async function registerAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = await loadPush();
  if (!Notifications) return;
  const channels: [string, string, ExpoNotifications.AndroidImportance][] = [
    ['default', 'KROMA', Notifications.AndroidImportance.DEFAULT],
    ['request_review', 'Requests to review', Notifications.AndroidImportance.HIGH],
    ['media_available', 'Ready to watch', Notifications.AndroidImportance.HIGH],
  ];
  await Promise.all(
    channels.map(([id, name, importance]) =>
      Notifications.setNotificationChannelAsync(id, {
        name,
        importance,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      }),
    ),
  );
}

/** The native half of the shared push flow. */
export const nativePush: PushCapability = {
  /**
   * Deliberately does NOT reject a simulator. A simulator shows the permission
   * dialog perfectly well, and on iOS 16+ it can register for real pushes; only
   * minting a token may fail, which `subscribe` reports precisely once it has
   * actually tried. Refusing up front would hide the prompt from exactly the
   * devices most testing happens on.
   */
  async blocker(): Promise<PushBlocker | null> {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unsupported';
    const Notifications = await loadPush();
    // The JS is here but the native module is not: this build predates the
    // dependency and needs `expo prebuild` + a native rebuild.
    if (!Notifications) return 'needs-rebuild';
    const { status } = await Notifications.getPermissionsAsync();
    // `denied` is terminal from inside the app: iOS only ever prompts once, so
    // the user has to change it in Settings.
    return status === 'denied' ? 'denied' : null;
  },

  async subscribe(): Promise<SubscribeBody> {
    const Notifications = await loadPush();
    if (!Notifications) throw new Error('needs-rebuild');

    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    if (status !== 'granted') throw new Error('denied');

    await registerCategories();
    await registerAndroidChannels();

    // Only now can a simulator fail: it has shown the dialog, but may have no
    // APNs/FCM registration behind it.
    let token: Awaited<ReturnType<typeof Notifications.getDevicePushTokenAsync>>;
    try {
      token = await Notifications.getDevicePushTokenAsync();
    } catch (e) {
      throw new Error(Device.isDevice ? 'unsupported' : 'simulator', { cause: e });
    }
    const transport = transportFor(token.type);
    if (!transport) throw new Error('unsupported');

    return {
      transport,
      // APNs hands back hex, FCM a string; both ride as the endpoint.
      endpoint: String(token.data),
      device: deviceLabel(),
    };
  },

  async endpoint() {
    const Notifications = await loadPush();
    if (!Notifications) return null;
    try {
      const token = await Notifications.getDevicePushTokenAsync();
      return String(token.data);
    } catch {
      // No token to hand back (permission revoked, or a simulator).
      return null;
    }
  },

  async unsubscribe() {
    // Nothing to undo on the device: an APNs/FCM token is not "unsubscribed",
    // it simply stops being sent to once the server drops the row.
  },
};

/** A human label for the account's "your devices" list. */
function deviceLabel(): string {
  const name = Device.deviceName?.trim();
  const model = Device.modelName ?? Platform.OS;
  return name && name !== model ? `${name} (${model})` : model;
}
