import { type ReactNode, useMemo } from 'react';
import type { I18n } from '../i18n';
import type { Locale } from '../registry';
import type { Catalog } from '../types';
import { I18nContext, type I18nValue } from './context';

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
  const value = useMemo<I18nValue>(
    () => ({ i18n, locale, setLocale: (next) => onLocaleChange?.(next) }),
    [i18n, locale, onLocaleChange],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
