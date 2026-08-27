import { Fragment, type ReactNode, useMemo, useSyncExternalStore } from 'react';
import { activeLocaleOverride, onOverridesChange, overridesRevision } from '../dev-overrides';
import type { I18n } from '../i18n';
import type { Locale } from '../registry';
import type { Catalog } from '../types';
import { I18nContext, type I18nValue } from './context';

const NONE = () => 0;
const UNSET = () => null;

export interface I18nProviderProps {
  /** The instance built by `createI18n`. */
  i18n: I18n<string, Catalog>;
  /** Controlled: the app owns the resolved locale and `useSetLocale` asks for a
   *  change through `onLocaleChange` rather than setting it here. */
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
  children: ReactNode;
}

export function I18nProvider({
  i18n,
  locale,
  onLocaleChange,
  children,
}: Readonly<I18nProviderProps>) {
  // One subscription for the whole tree. `useT` is called from hundreds of
  // components, and a store watch in each of them would mean a set insert per
  // mount for something that changes only when a module registers a catalog.
  const version = useSyncExternalStore(i18n.subscribe, i18n.version, i18n.version);
  // Hooks rather than bare reads: under the React Compiler a call with no
  // arguments is memoised on nothing and answers once for the life of the
  // mount, which is how a dev switch moves and the tree does not.
  const overrides = useSyncExternalStore(onOverridesChange, overridesRevision, NONE);
  const override = useSyncExternalStore(onOverridesChange, activeLocaleOverride, UNSET);
  const active = (override as Locale | null) ?? locale;
  const value = useMemo<I18nValue>(
    () => ({ i18n, locale: active, version, setLocale: (next) => onLocaleChange?.(next) }),
    [i18n, active, version, onLocaleChange],
  );
  // The key is 0 for the whole life of a build that never loads the dev tools.
  // When one of their switches moves it is what discards the rendered tree:
  // React Compiler memoisation is per mount, so a component that already
  // resolved a string would otherwise keep showing it.
  return (
    <I18nContext.Provider value={value}>
      <Fragment key={overrides}>{children}</Fragment>
    </I18nContext.Provider>
  );
}
