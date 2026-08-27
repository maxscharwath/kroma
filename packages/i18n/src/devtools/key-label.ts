import { answeringLayer, type CatalogLayer } from '../chain';
import type { KeyInspector } from '../dev-overrides';

const BASE = 'core';
const UNANSWERED = 'missing';

function source(layer: CatalogLayer | undefined, locale: string): string {
  if (!layer) return UNANSWERED;
  const scope = layer.scope ?? BASE;
  return layer.locale === locale ? scope : `${scope}@${layer.locale}`;
}

/** What a message renders as while the key inspector is installed:
 *  `[core/player.play]` for an app key, `[tv.kroma.torrents/queue.title]` for one
 *  a module's own catalog answered, `[missing/foo]` for one nothing answers, and
 *  `[core@en/foo]` when the answer came from the fallback locale. */
export const keyLabel: KeyInspector = (chain, locale, key, vars, plural) =>
  `[${source(answeringLayer(chain, locale, key, vars, plural), locale)}/${key}]`;
