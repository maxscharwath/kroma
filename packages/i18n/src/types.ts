/** The variables a message interpolates. A numeric one can also select a
 *  plural variant; see {@link PluralCategory}. */
export type TVars = Record<string, string | number>;

/** A translation function bound to one locale. */
export type Translate<K extends string> = (key: K, vars?: TVars) => string;

/** One locale's messages, key to template. */
export type Catalog = Readonly<Record<string, string>>;

/** Every locale's messages. A locale may be absent, in which case lookups for
 *  it fall through to the default locale. */
export type Catalogs<L extends string> = Readonly<Partial<Record<L, Catalog>>>;

/** A CLDR plural category. Catalogs carry it as a key suffix (`key_one`). */
export type PluralCategory = Intl.LDMLPluralRule;

export interface I18nInstance<L extends string, K extends string> {
  readonly translate: (locale: L, key: K, vars?: TVars) => string;
  readonly translateIn: (
    catalogs: Catalogs<L>,
    locale: L,
    key: string,
    vars?: TVars,
  ) => string | undefined;
  readonly createTranslator: (locale: L) => Translate<K>;
}

export interface LocaleSet<L extends string, D extends L = L> {
  readonly detectLocale: (preferred?: string | null) => L;
  readonly isLocale: (value: unknown) => value is L;
  readonly normalizeLocale: (tag?: string | null) => L | null;
  readonly DEFAULT_LOCALE: D;
  readonly SUPPORTED_LOCALES: ReadonlySet<L>;
  readonly LOCALES: ReadonlyArray<{ readonly code: L; readonly labelKey: `lang.${L}` }>;
}

export type MessageKeyOf<I> = I extends I18nInstance<infer _L, infer K> ? K : never;
