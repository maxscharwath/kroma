// KROMA service worker: the half of Web Push that runs when the app is closed.
import * as z from 'zod/mini';

const sw = self as unknown as SwGlobalScope;

// Take over as soon as an updated worker is installed, rather than waiting for
// every tab to close: a stale worker showing the old notification format is
// worse than a momentary swap.
sw.addEventListener('install', () => sw.skipWaiting());
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()));

/**
 * A field that is only useful when it is a non-empty string.
 *
 * Every field degrades on its own rather than failing the whole payload: a push
 * that shows nothing breaches the "must be user-visible" rule that gets a
 * site's push permission revoked, so one bad field must not cost the
 * notification. `catch` is what buys that — absent, wrong type, or empty all
 * land on `undefined`, and the caller's fallback takes over.
 */
const text = z.catch(z.optional(z.string().check(z.minLength(1))), undefined);

const Action = z.object({
  id: z.catch(z.string(), ''),
  label: z.catch(z.string(), ''),
  kind: z.catch(z.optional(z.enum(['link', 'api'])), undefined),
  href: text,
  method: text,
});

/** Anything that is not a list of actions is no actions at all. */
const actions = z.catch(z.array(Action), []);

/**
 * The decrypted push body — the same JSON the server builds in
 * `services/notify/push.rs::payload_of`.
 */
const Payload = z.object({
  title: text,
  body: text,
  imageUrl: text,
  link: text,
  id: text,
  actions,
});

/** What we put in `notification.data`, read back after a structured clone. */
const NotificationData = z.object({ link: text, actions });

const EMPTY = Payload.parse({});

type PushAction = z.infer<typeof Action>;

sw.addEventListener('push', (event) => {
  // A push with no payload still deserves a notification: browsers may strip the
  // body under storage pressure, and showing nothing would breach the
  // "must be user-visible" rule that gets a site's push permission revoked.
  let raw: unknown;
  try {
    raw = event.data ? event.data.json() : {};
  } catch {
    raw = {};
  }
  const data = Payload.safeParse(raw).data ?? EMPTY;

  const options = {
    body: data.body ?? '',
    icon: '/apple-touch-icon.png',
    badge: '/favicon-32.png',
    // The poster, when there is one — a film's artwork is the point.
    image: data.imageUrl,
    // Collapse repeats of the same notification (a retried delivery) instead of
    // stacking duplicates.
    tag: data.id,
    renotify: Boolean(data.id),
    data: { link: data.link ?? '/', actions: data.actions },
    // Chrome shows at most two; the server orders them most-useful-first.
    actions: data.actions.slice(0, 2).map((a) => ({ action: a.id, title: a.label })),
  };
  event.waitUntil(sw.registration.showNotification(data.title ?? 'KROMA', options));
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clicked = NotificationData.safeParse(event.notification.data).data;
  const chosen = event.action ? clicked?.actions.find((a) => a.id === event.action) : undefined;

  event.waitUntil(handleClick(chosen, clicked?.link));
});

/**
 * A tap on the body opens `link`. A tap on an action button either navigates
 * (`kind: 'link'`) or calls the server directly (`kind: 'api'`) — the latter is
 * what lets a moderator approve a request from the lock screen without the app
 * ever coming to the foreground.
 */
async function handleClick(action: PushAction | undefined, link: string | undefined) {
  if (action?.kind === 'api' && action.href) {
    try {
      // Same-origin: the session cookie/bearer is not available here, but the
      // API is on this origin and the request carries the browser's credentials.
      await fetch(action.href, { method: action.method ?? 'POST', credentials: 'include' });
      return;
    } catch {
      // Fall through to opening the app so the user can act by hand.
    }
  }
  await openApp((action?.kind === 'link' ? action.href : link) ?? '/');
}

/** Focus an existing KROMA tab and navigate it, or open a new one. */
async function openApp(path: string) {
  const url = new URL(path, sw.location.origin).href;
  const clientList = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientList) {
    // Reuse a tab that is already on this origin rather than piling up windows.
    if (new URL(client.url).origin === sw.location.origin && 'focus' in client) {
      await client.focus();
      if ('navigate' in client) {
        try {
          await client.navigate(url);
        } catch {
          /* cross-origin or unsupported: the focus alone is still useful */
        }
      }
      return;
    }
  }
  if (sw.clients.openWindow) await sw.clients.openWindow(url);
}

// The browser can rotate a subscription without asking. Re-register with the
// server, or that device silently stops receiving anything.
sw.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const subscription = event.newSubscription;
      if (!subscription) return;
      const key = subscription.getKey ? subscription.getKey.bind(subscription) : null;
      if (!key) return;
      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          transport: 'webpush',
          endpoint: subscription.endpoint,
          p256dh: base64Url(key('p256dh')),
          auth: base64Url(key('auth')),
        }),
      });
    })(),
  );
});

function base64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return null;
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCodePoint(b);
  const b64 = btoa(binary).replaceAll('+', '-').replaceAll('/', '_');
  // Strip the padding in one linear pass. A `/=+$/` regex is super-linear here:
  // unanchored at the start, it retries and backtracks the run at every
  // position (same reasoning as stripTrailingSlash in the Synology generator).
  let end = b64.length;
  while (end > 0 && b64[end - 1] === '=') end--;
  return b64.slice(0, end);
}
