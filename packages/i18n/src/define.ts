import { createI18n, type I18n, type I18nConfig, type Messages } from './i18n';
import { createLocales } from './locales';
import type { LocaleSet } from './types';

export interface DefineI18nConfig<
  C extends Record<string, Record<string, string>>,
  D extends keyof C & string,
> extends Omit<I18nConfig<C>, 'catalogs' | 'defaultLocale'> {
  /** One catalog per locale, keyed by code. The default locale's is the
   *  complete one: it types the message keys and every other locale falls back
   *  to it. */
  catalogs: C;
  defaultLocale: D;
  /** Each locale's name for itself, when a catalog does not already carry it
   *  under `lang.<code>`. The endonym is what `normalizeLocale` accepts beside
   *  a BCP 47 tag, because that is how an account's language preference tends
   *  to be stored. */
  locales?: Partial<Record<keyof C & string, string>>;
}

function endonyms<C extends Record<string, Record<string, string>>>(
  catalogs: C,
  given: Partial<Record<string, string>> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of Object.keys(catalogs)) {
    out[code] = given?.[code] ?? catalogs[code]?.[`lang.${code}`] ?? code;
  }
  return out;
}

/**
 * Everything an app needs from this package, from one call.
 *
 * ```ts
 * export const { i18n, translate, LOCALES, DEFAULT_LOCALE } = defineI18n({
 *   catalogs: { fr, en },
 *   defaultLocale: 'fr',
 * });
 *
 * declare module '@kroma/i18n' {
 *   interface Register extends InferRegister<typeof i18n> {}
 * }
 * ```
 *
 * There is no separate table of language names: a catalog names its own
 * language under `lang.<code>` (`"lang.fr": "Français"` in `fr.json`), which is
 * the entry the picker renders anyway, so writing it twice is how the two drift
 * apart. Pass `locales` only for a language whose catalog does not carry it.
 *
 * The `declare module` block is the one part that cannot be inferred, because a
 * type has to be written where the compiler can see it. After it, `Locale`,
 * `MessageKey` and `Translate` are this app's own everywhere they are imported.
 *
 * {@link createLocales} and {@link createI18n} stay separate underneath, for a
 * build that wants the locales without pulling the catalogs in.
 */
export function defineI18n<
  const C extends Record<string, Record<string, string>>,
  const D extends keyof C & string,
>(
  config: DefineI18nConfig<C, D>,
): LocaleSet<keyof C & string, D> & {
  i18n: I18n<keyof C & string, Messages<C[D]>>;
  /** Render one message in a given locale. */
  translate: I18n<keyof C & string, Messages<C[D]>>['translate'];
  /** A translator bound to one locale, optionally scoped to catalogs added at
   *  runtime. */
  translator: I18n<keyof C & string, Messages<C[D]>>['translator'];
  /** Register catalogs that arrive at runtime, as a module being loaded would.
   *  Returns a disposer. */
  addCatalogs: I18n<keyof C & string, Messages<C[D]>>['add'];
} {
  const { locales, catalogs, defaultLocale, ...rest } = config;
  const set = createLocales(endonyms(catalogs, locales), defaultLocale);
  const i18n = createI18n({ ...rest, catalogs, defaultLocale });
  return {
    ...set,
    i18n,
    translate: i18n.translate,
    translator: i18n.translator,
    addCatalogs: i18n.add,
  } as never;
}
