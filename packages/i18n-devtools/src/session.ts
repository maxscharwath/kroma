import { z } from 'zod';

const KEY = 'kroma:i18n-devtools';

const Session = z.object({
  open: z.boolean().default(false),
  keys: z.boolean().default(false),
  locale: z.string().max(16).nullable().default(null),
  x: z.number().finite().nullable().default(null),
  y: z.number().finite().nullable().default(null),
});

/** What the tools remember for the tab: survives a hot reload and a refresh,
 *  and is gone when the tab is. */
export type DevtoolsSession = z.infer<typeof Session>;

const CLOSED: DevtoolsSession = { open: false, keys: false, locale: null, x: null, y: null };

export function readSession(): DevtoolsSession {
  const stored = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY);
  if (!stored || stored.length > 512) return CLOSED;
  try {
    const parsed = Session.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : CLOSED;
  } catch {
    return CLOSED;
  }
}

export function writeSession(patch: Partial<DevtoolsSession>): DevtoolsSession {
  const next = { ...readSession(), ...patch };
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
