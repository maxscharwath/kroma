import { resolveInChain, translateChain } from './chain';
import { activeKeyInspector, onOverridesChange, overridesRevision } from './dev-overrides';
import { LazyNamespaces, type NamespaceLoaders } from './lazy-namespaces';
import { CatalogStore, type SCHEMA_KEY } from './store';
import type { Catalog, Catalogs, PluralRule, TVars } from './types';

/** A catalog's messages: everything but the `$schema` pointer. Distinct from
 *  `Messages` in ./registry, which is the augmented map for the whole app. */
export type CatalogMessages<C> = Omit<C, typeof SCHEMA_KEY>;

type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (
  u: infer I,
) => void
  ? I
  : never;

/** The messages every lazy namespace declares in the default locale, folded
 *  into one map so they type `MessageKey` beside the eager ones. */
export type LazyMessages<Z extends NamespaceLoaders, D extends string> = UnionToIntersection<
  {
    [N in keyof Z]: Z[N] extends () => Promise<infer P> ? NonNullable<P[D & keyof P]> : never;
  }[keyof Z]
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
  /** Fetch lazy namespaces, once each: repeated and concurrent calls share the
   *  fetch. Resolves when every one named has landed. A key of a namespace
   *  nobody loaded starts its fetch on first miss, so this is how a screen
   *  avoids the flash rather than the only way its messages arrive. */
  load(...names: N[]): Promise<void>;
  /** Whether the base catalogs declare `key`. */
  has(key: string): boolean;
  /** A snapshot that changes whenever a scope is added or removed. */
  version(): number;
  subscribe(listener: () => void): () => void;
}

export interface I18nConfig<
  C extends Record<string, Record<string, string>>,
  Z extends NamespaceLoaders = Record<never, never>,
> {
  catalogs: C;
  defaultLocale: keyof C & string;
  /** Override plural category selection. Only needed where `Intl.PluralRules`
   *  is absent or disagrees with a peer implementation you have to match. */
  plural?: PluralRule;
  /** Namespaces fetched on first use rather than shipped in `catalogs`, one
   *  loader per key prefix. Their keys type like the eager ones. */
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
  const Z extends NamespaceLoaders = Record<never, never>,
>(
  config: I18nConfig<C, Z> & { defaultLocale: D },
): I18n<keyof C & string, CatalogMessages<C[D]> & LazyMessages<Z, D>, keyof Z & string> {
  type L = keyof C & string;
  type K = keyof CatalogMessages<C[D]> & string;

  const { catalogs, defaultLocale, plural, lazy } = config;
  const store = new CatalogStore<L>(catalogs as unknown as Catalogs<L>, defaultLocale as L);
  const namespaces = new LazyNamespaces<keyof Z & string>(lazy ?? {}, (part) => store.extend(part));
  const missed = (key: string): string => {
    namespaces.missed(key);
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
    const cacheKey = scope === undefined ? locale : `${locale}\u0000${scope}`;
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
            return inspector({ key, from, locale, text: text ?? missed(key), vars });
          }
        : (key, vars) =>
            translateChain(store.chain(locale, scope), locale, key, vars, plural) ?? missed(key);
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
