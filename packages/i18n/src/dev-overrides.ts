import type { Chain } from './chain';
import type { PluralRule, TVars } from './types';

/** Renders a message as something that names its key rather than its text. */
export type KeyInspector = (
  chain: Chain,
  locale: string,
  key: string,
  vars?: TVars,
  plural?: PluralRule,
) => string;

let inspector: KeyInspector | null = null;
let locale: string | null = null;
let revision = 0;
const listeners = new Set<() => void>();

function changed(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

export function activeKeyInspector(): KeyInspector | null {
  return inspector;
}

/** Route every message every instance renders through `next`, or `null` to
 *  stop. Process-wide on purpose: the dev tools are one switch for the page,
 *  and they reach an instance they were never handed. */
export function installKeyInspector(next: KeyInspector | null): void {
  if (inspector === next) return;
  inspector = next;
  changed();
}

export function activeLocaleOverride(): string | null {
  return locale;
}

/** Render every provider in `next` instead of the locale the app resolved, or
 *  `null` to give it back. Nothing is persisted and no account preference
 *  moves: this lasts as long as the page does. */
export function installLocaleOverride(next: string | null): void {
  if (locale === next) return;
  locale = next;
  changed();
}

/** Part of an instance's version snapshot, and the key a provider remounts its
 *  subtree on, so a memoised component cannot keep a string it rendered before
 *  the switch. Never moves unless the dev tools are loaded. */
export function overridesRevision(): number {
  return revision;
}

export function onOverridesChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
