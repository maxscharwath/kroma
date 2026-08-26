import { translateChain } from './chain';
import type { Catalog, Catalogs, PluralRule, TVars } from './types';

const EMPTY: Catalog = {};

/** Render `key` from catalogs that arrived at runtime, falling back to
 *  `defaultLocale`, or `undefined` when neither knows it.
 *
 *  Prefer an instance from `createI18n` and `add()` for anything long-lived;
 *  this is the one-shot seam for a caller holding a catalog object it does not
 *  want to register. */
export function translateIn<L extends string>(
  catalogs: Catalogs<L>,
  locale: L,
  defaultLocale: L,
  key: string,
  vars?: TVars,
  plural?: PluralRule,
): string | undefined {
  const cats = catalogs as Record<string, Catalog | undefined>;
  const chain = [cats[locale] ?? EMPTY, cats[defaultLocale] ?? EMPTY];
  return translateChain(chain, locale, key, vars, plural);
}
