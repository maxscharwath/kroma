// What happens when someone taps a push.
//
// Two paths, and the difference matters: tapping the notification BODY opens the
// app at the linked screen, while tapping an action BUTTON may not open the app
// at all (`opensAppToForeground: false`) — a moderator approving a request from
// the lock screen expects the request approved, not the app launched.
//
// The buttons themselves come from the category the app registered (APNs can
// only show pre-registered actions), but what each one DOES rides in the
// payload. So the phone runs exactly the call the web row's button would,
// instead of reconstructing an id out of the link.

import type { KromaClient } from '@kroma/core';
import type * as Notifications from 'expo-notifications';

import { mobileRoute } from './route';

/** One action button's effect, as the server sent it. */
export interface PushAction {
  id: string;
  method: string;
  href: string;
}

/** The fields KROMA puts on a push, whichever service delivered it. */
export interface PushData {
  id?: string;
  link?: string;
  category?: string;
  actions: PushAction[];
}

/** Read our payload off a notification, whatever shape the platform wrapped it in. */
export function pushData(notification: Notifications.Notification): PushData {
  const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  return {
    id: str(data.id),
    link: str(data.link),
    category: str(data.category),
    actions: parseActions(data.actions),
  };
}

/**
 * Actions arrive as an array on iOS and as an encoded string on Android (every
 * FCM `data` value must be a string), so both shapes are accepted.
 */
function parseActions(raw: unknown): PushAction[] {
  const list = typeof raw === 'string' ? safeParse(raw) : raw;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { id, method, href } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof href !== 'string') return [];
    return [{ id, href, method: typeof method === 'string' ? method : 'POST' }];
  });
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Act on a tap. Returns the route to navigate to, or `null` when the tap needs
 * no navigation — an action that ran in the background, or a link with no phone
 * screen.
 */
export async function handleTap(
  response: Notifications.NotificationResponse,
  client: KromaClient,
): Promise<string | null> {
  const data = pushData(response.notification);
  const action = data.actions.find((a) => a.id === response.actionIdentifier);

  if (action) {
    try {
      await client.runNotificationAction(action);
      return null; // decided in the background; nothing to open
    } catch {
      // It did not land (offline, or already reviewed by someone else). Fall
      // through and open the app so it can be done by hand, rather than
      // silently swallowing the tap.
    }
  }

  return mobileRoute(data.link);
}
