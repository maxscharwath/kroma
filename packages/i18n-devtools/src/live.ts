/** How much of the page the overlay marks, off through everything. */
export const OUTLINES = ['off', 'problems', 'all'] as const;

export type Outline = (typeof OUTLINES)[number];

/** The three switches that rewrite a message: what the tools are doing to the
 *  page right now, as opposed to how the panel is arranged. */
export interface Live {
  keys: boolean;
  outline: Outline;
  locale: string | null;
}

// Held on the page rather than in this module, for two reasons that pull the
// same way. A hot update re-runs the module the tools were injected into, and
// state in a module variable would be reset by the very refresh that is meant
// to show it. And a module's front end bundles its own copy of this file, so a
// module variable would reach the core's strings and stop at the module's.
//
// Not in `sessionStorage`, which is the other half of the split: these come
// back off on a fresh page, because React hydrates by comparing the server's
// text with the client's and all three change what a message renders as.
const SHARED = '__kromaI18nDevtoolsLive';

const OFF: Live = { keys: false, outline: 'off', locale: null };

interface Held {
  live: Live;
  readonly listeners: Set<() => void>;
}

function held(): Held {
  const found = Reflect.get(globalThis, SHARED) as Held | undefined;
  if (found) return found;
  const fresh: Held = { live: OFF, listeners: new Set() };
  Reflect.set(globalThis, SHARED, fresh);
  return fresh;
}

/** What the switches are set to, the same object until one of them moves. */
export function liveState(): Live {
  return held().live;
}

/** Move one or more switches, and tell everyone watching. */
export function setLive(fields: Partial<Live>): void {
  const state = held();
  const next = { ...state.live, ...fields };
  if (same(state.live, next)) return;
  state.live = next;
  for (const listener of state.listeners) listener();
}

export function onLiveChange(listener: () => void): () => void {
  const { listeners } = held();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function same(a: Live, b: Live): boolean {
  return a.keys === b.keys && a.outline === b.outline && a.locale === b.locale;
}
