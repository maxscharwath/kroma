import { interpolate } from './interpolate';
import { resolvePluralKey } from './plural';
import type { Catalog, Catalogs, TVars } from './types';

const EMPTY: Catalog = {};

/** Render `key` from `catalogs` in `locale`, falling back to `defaultLocale`,
 *  or `undefined` when neither knows it. Prefer a bound instance from
 *  `createI18n`; this is the seam for catalogs that arrive at runtime, such as
 *  a module shipping its own messages. */
export function translateIn<L extends string>(
  catalogs: Catalogs<L>,
  locale: L,
  defaultLocale: L,
  key: string,
  vars?: TVars,
): string | undefined {
  const cats = catalogs as Record<string, Catalog | undefined>;
  const own = cats[locale] ?? EMPTY;
  const fallback = cats[defaultLocale] ?? EMPTY;
  const lookupKey = vars ? resolvePluralKey(own, fallback, locale, key, vars) : key;
  const template = own[lookupKey] ?? fallback[lookupKey];
  return template === undefined ? undefined : interpolate(template, vars);
}
