import type { NamespaceCatalogs } from './announce';
import { resolveInChain, translateChain } from './chain';
import { activeKeyInspector, onOverridesChange, overridesRevision } from './dev-overrides';
import { namespaceOf } from './layout';
import { Namespaces } from './namespaces';
import type { UnionToIntersection } from './registry';
import { CatalogStore, type SCHEMA_KEY } from './store';
import type { Catalog, Catalogs, PluralRule, TVars } from './types';

/** A catalog's messages: everything but the `$schema` pointer. Distinct from
 *  `Messages` in ./registry, which is the augmented map for the whole app. */
export type CatalogMessages<C> = Omit<C, typeof SCHEMA_KEY>;

/** Namespaces offered for fetching: by name, then by locale. */
export type LazyCatalogs = Readonly<Record<string, NamespaceCatalogs>>;

type Resolved<S> = S extends () => Promise<infer C> ? C : S;

/** The messages every lazy namespace declares in the default locale, folded
 *  into one map so they type `MessageKey` beside the eager ones. */
export type LazyMessages<Z extends LazyCatalogs, D extends string> = UnionToIntersection<
  { [N in keyof Z]: Resolved<Z[N][D & keyof Z[N]]> }[keyof Z]
>;

/** A translator bound to one scope: the scope's own keys are not knowable from
 *  here, so any string is accepted while the base keys still autocomplete. */
export type ScopedTranslate<K extends string> = (key: K | (string & {}), vars?: TVars) => string;

export interface I18n<L extends string, M extends Catalog, N extends string = string> {
  readonly defaultLocale: L;
  /** Every locale the base catalogs answer in, the default one first. */
  locales(): readonly L[];
  /** Render one message. Unknown keys render as the key itself, which is a
   *  visible placeholder rather than an empty hole. */
  translate(locale: L, key: keyof M & string, vars?: TVars): string;
  /** A translator bound to a locale. Pass a scope to put that scope's added
   *  catalogs ahead of the base ones. */
  translator(locale: L): (key: keyof M & string, vars?: TVars) => string;
  translator(locale: L, scope: string): ScopedTranslate<keyof M & string>;
  /** Add a scope's catalogs at runtime, as a module being loaded would.
   *  Returns a disposer; adding the same scope again replaces it. */
  add(scope: string, catalogs: Catalogs<string>): () => void;
  /** A namespace the running code needs, as the chunk carrying it says on
   *  evaluation: a catalog given outright lands now, a loader is fetched for
   *  every warmed locale. */
  register(namespace: string, catalogs: NamespaceCatalogs): void;
  /** Fetch every needed namespace in `locale`, now and as more are registered.
   *  The provider calls it for the locale it renders. */
  warm(locale: L): void;
  /** What is still being fetched for `locale`, to suspend on; `null` when
   *  everything needed has landed. */
  pending(locale: L): Promise<void> | null;
  /** Fetch `names` in every locale they have a source for. */
  load(...names: N[]): Promise<void>;
  /** Whether the base catalogs declare `key`. */
  has(key: string): boolean;
  /** A snapshot that changes whenever a scope is added or removed. */
  version(): number;
  subscribe(listener: () => void): () => void;
}

export interface I18nConfig<
  C extends Record<string, Record<string, string>>,
  Z extends LazyCatalogs = Record<never, never>,
> {
  catalogs: C;
  defaultLocale: keyof C & string;
  /** Override plural category selection. Only needed where `Intl.PluralRules`
   *  is absent or disagrees with a peer implementation you have to match. */
  plural?: PluralRule;
  /** Namespaces not shipped in `catalogs`, fetched per locale when a key of
   *  theirs misses. Their keys type like the eager ones. */
  lazy?: Z;
}

/** What {@link Register} should be augmented with for a given instance:
 *
 *  ```ts
 *  declare module '@kroma/i18n' {
 *    interface Register extends InferRegister<typeof i18n> {}
 *  }
 *  ``` */
export type InferRegister<I> =
  I extends I18n<infer L, infer M, string> ? { locale: L; messages: M } : never;

/**
 * Build a translator from JSON catalogs.
 *
 * `$t(key)` references inside the catalogs are expanded here, once, so
 * translating stays a single interpolation pass. The message-key type comes
 * from the default locale's catalog, which is therefore the one that has to be
 * complete: every other locale falls back to it.
 */
export function createI18n<
  const C extends Record<string, Record<string, string>>,
  const D extends keyof C & string,
  const Z extends LazyCatalogs = Record<never, never>,
>(
  config: I18nConfig<C, Z> & { defaultLocale: D },
): I18n<keyof C & string, CatalogMessages<C[D]> & LazyMessages<Z, D>, keyof Z & string> {
  type L = keyof C & string;
  type K = keyof CatalogMessages<C[D]> & string;

  const { catalogs, defaultLocale, plural, lazy } = config;
  const store = new CatalogStore<L>(catalogs as unknown as Catalogs<L>, defaultLocale as L);
  const namespaces = new Namespaces((locale, catalog) => store.extend({ [locale]: catalog }));
  for (const [locale, catalog] of Object.entries(catalogs)) {
    for (const key of Object.keys(catalog)) namespaces.settle(namespaceOf(key), locale);
  }
  for (const [namespace, sources] of Object.entries(lazy ?? {})) {
    namespaces.announce(namespace, sources, false);
  }
  const missed = (locale: string, key: string): string => {
    namespaces.missed(key, locale, defaultLocale);
    return key;
  };

  type Bound = (key: K | (string & {}), vars?: TVars) => string;

  // One translator per locale and scope, forever. The closure reads the chain
  // on every call rather than capturing it, so an added catalog still reaches
  // it. Identity matters: a React hook hands this straight to callers who put
  // it in a `useMemo` dependency list, and a fresh closure per render would
  // quietly defeat all of them.
  const bound = new Map<string, Bound>();
  let revision = overridesRevision();

  const translator = (locale: L, scope?: string) => {
    const current = overridesRevision();
    if (current !== revision) {
      bound.clear();
      revision = current;
    }
    const cacheKey = scope === undefined ? locale : `${locale} ${scope}`;
    let fn = bound.get(cacheKey);
    if (!fn) {
      const inspector = activeKeyInspector();
      fn = inspector
        ? (key, vars) => {
            const { at, text } = resolveInChain(
              store.chain(locale, scope),
              locale,
              key,
              vars,
              plural,
            );
            const from = at === -1 ? undefined : store.sources(locale, scope)[at];
            return inspector({ key, from, locale, text: text ?? missed(locale, key), vars });
          }
        : (key, vars) =>
            translateChain(store.chain(locale, scope), locale, key, vars, plural) ??
            missed(locale, key);
      bound.set(cacheKey, fn);
    }
    return fn;
  };

  const codes = [
    defaultLocale as L,
    ...(Object.keys(catalogs) as L[]).filter((code) => code !== defaultLocale),
  ];

  return {
    defaultLocale: defaultLocale as L,
    locales: () => codes,
    translate: (locale, key, vars) => translator(locale)(key, vars),
    translator,
    add: (scope, added) => store.add(scope, added),
    register: (namespace, announced) => namespaces.announce(namespace, announced, true),
    warm: (locale) => namespaces.warm(locale),
    pending: (locale) => namespaces.pending(locale),
    load: (...names) => namespaces.load(names),
    has: (key) => store.has(key),
    version: () => store.version() + overridesRevision(),
    subscribe: (listener) => {
      const stopStore = store.subscribe(listener);
      const stopInspector = onOverridesChange(listener);
      return () => {
        stopStore();
        stopInspector();
      };
    },
  } as I18n<L, CatalogMessages<C[D]> & LazyMessages<Z, D>, keyof Z & string>;
}
