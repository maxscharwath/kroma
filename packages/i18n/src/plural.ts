import type { Catalog, PluralCategory, TVars } from './types';

const RULES = new Map<string, Intl.PluralRules | null>();

function rulesFor(locale: string): Intl.PluralRules | null {
  const cached = RULES.get(locale);
  if (cached !== undefined) return cached;
  let rules: Intl.PluralRules | null = null;
  try {
    rules = new Intl.PluralRules(locale);
  } catch {
    rules = null;
  }
  RULES.set(locale, rules);
  return rules;
}

/** The CLDR plural category `count` falls in for `locale`. Falls back to a
 *  one/other split where `Intl.PluralRules` is missing, which is the older
 *  television engines. Note that French puts 0 in `one` and English does not. */
export function selectCategory(locale: string, count: number): PluralCategory {
  return rulesFor(locale)?.select(count) ?? (count === 1 ? 'one' : 'other');
}

function variantIn(catalog: Catalog, locale: string, stem: string, n: number): string | undefined {
  // An explicit `_zero` wins at zero even where CLDR has no `zero` category,
  // because "no results" is usually its own sentence rather than a plural.
  if (n === 0 && catalog[`${stem}_zero`] !== undefined) return `${stem}_zero`;
  const category = `${stem}_${selectCategory(locale, n)}`;
  if (catalog[category] !== undefined) return category;
  const other = `${stem}_other`;
  if (catalog[other] !== undefined) return other;
  return undefined;
}

function resolveIn(catalog: Catalog, locale: string, key: string, vars: TVars): string | undefined {
  const count = vars.count;
  if (typeof count === 'number') {
    const hit = variantIn(catalog, locale, key, count);
    if (hit) return hit;
  }
  for (const name in vars) {
    if (name === 'count' || !Object.hasOwn(vars, name)) continue;
    const value = vars[name];
    if (typeof value !== 'number') continue;
    const hit = variantIn(catalog, locale, `${key}_${name}`, value);
    if (hit) return hit;
  }
  return undefined;
}

/** The catalog key a message resolves to once its numeric variables have
 *  chosen a plural variant.
 *
 *  A variant is only ever taken from the catalog that will also supply the
 *  template, so a locale cannot borrow another language's singular just
 *  because it happens to define one.
 *
 *  `count` selects `key_one` / `key_other` / `key_zero`. Any other numeric
 *  variable selects `key_<name>_one` and so on, which is how a message whose
 *  quantity is not called "count" pluralises. Only one variable can select,
 *  since one key names one template: `count` is tried first, then the rest in
 *  declaration order. */
export function resolvePluralKey(
  own: Catalog,
  fallback: Catalog,
  locale: string,
  key: string,
  vars: TVars,
): string {
  const mine = resolveIn(own, locale, key, vars);
  if (mine) return mine;
  if (own[key] !== undefined) return key;
  return resolveIn(fallback, locale, key, vars) ?? key;
}
