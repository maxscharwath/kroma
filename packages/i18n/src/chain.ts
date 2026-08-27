import { interpolate } from './interpolate';
import { resolvePluralKey } from './plural';
import type { Catalog, PluralRule, TVars } from './types';

/** One catalog in a lookup, and where it came from: the scope that added it, or
 *  `null` for the base catalogs the app was built with. */
export interface CatalogLayer {
  readonly catalog: Catalog;
  readonly scope: string | null;
  readonly locale: string;
}

/** The catalogs a lookup walks, most specific first. A scoped translator puts
 *  the scope's own catalogs ahead of the base ones, and each locale is followed
 *  by the default locale it falls back to. */
export type Chain = readonly CatalogLayer[];

function template(
  catalog: Catalog,
  locale: string,
  key: string,
  vars?: TVars,
  plural?: PluralRule,
): string | undefined {
  return catalog[vars ? resolvePluralKey(catalog, locale, key, vars, plural) : key];
}

/** Render `key` against `chain`, or `undefined` when no catalog in it knows the
 *  key. Plural variants are resolved inside the first catalog that answers, so
 *  a locale can never take a variant from a language whose template it will not
 *  also use. */
export function translateChain(
  chain: Chain,
  locale: string,
  key: string,
  vars?: TVars,
  plural?: PluralRule,
): string | undefined {
  for (const { catalog } of chain) {
    const found = template(catalog, locale, key, vars, plural);
    if (found !== undefined) return interpolate(found, vars);
  }
  return undefined;
}

/** The layer {@link translateChain} would take the message from. */
export function answeringLayer(
  chain: Chain,
  locale: string,
  key: string,
  vars?: TVars,
  plural?: PluralRule,
): CatalogLayer | undefined {
  for (const layer of chain) {
    if (template(layer.catalog, locale, key, vars, plural) !== undefined) return layer;
  }
  return undefined;
}
