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

let installed: KeyInspector | null = null;
let revision = 0;
const listeners = new Set<() => void>();

export function activeKeyInspector(): KeyInspector | null {
  return installed;
}

/** Route every message every instance renders through `inspector`, or `null` to
 *  stop. */
export function installKeyInspector(inspector: KeyInspector | null): void {
  installed = inspector;
  revision += 1;
  for (const listener of listeners) listener();
}

export function inspectorRevision(): number {
  return revision;
}

export function onKeyInspectorChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
