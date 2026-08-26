import { expandRefs } from './nest';
import { translateIn } from './translate';
import type { Catalogs, I18nInstance, Translate, TVars } from './types';

/** Build a typed translator from JSON catalogs: `createI18n({ fr, en }, 'fr')`.
 *
 *  `$t(key)` references inside the catalogs are expanded here, once, so that
 *  translating stays a single interpolation pass. The message-key type comes
 *  from the default locale's catalog, which is therefore the one that has to
 *  be complete. */
export function createI18n<
  const C extends Record<string, Record<string, string>>,
  const D extends keyof C & string,
>(catalogs: C, defaultLocale: D): I18nInstance<keyof C & string, keyof C[D] & string> {
  type L = keyof C & string;
  type K = keyof C[D] & string;

  const cats = expandRefs(catalogs, defaultLocale) as unknown as Catalogs<L>;

  const translate = (locale: L, key: K, vars?: TVars): string =>
    translateIn(cats, locale, defaultLocale as unknown as L, key, vars) ?? key;

  const boundTranslateIn = (
    runtime: Catalogs<L>,
    locale: L,
    key: string,
    vars?: TVars,
  ): string | undefined => translateIn(runtime, locale, defaultLocale as unknown as L, key, vars);

  const createTranslator =
    (locale: L): Translate<K> =>
    (key, vars) =>
      translate(locale, key, vars);

  return { translate, translateIn: boundTranslateIn, createTranslator } as const;
}
