import { createI18n, type Translate as GenericTranslate, type MessageKeyOf } from '@kroma/i18n';
import { DEFAULT_LOCALE, type Locale } from './i18n-locales';

import en from './locales/en.json';
import fr from './locales/fr.json';

export { interpolate } from '@kroma/i18n';
export * from './i18n-locales';

const catalogs = { fr, en } satisfies Record<Locale, Readonly<Record<string, string>>>;

export const i18n = createI18n(catalogs, DEFAULT_LOCALE);

export const { translate, translateIn, createTranslator } = i18n;

export type MessageKey = MessageKeyOf<typeof i18n>;
export type Translate = GenericTranslate<MessageKey>;

export type { TVars } from '@kroma/i18n';
export type Catalogs<L extends string = Locale> = import('@kroma/i18n').Catalogs<L>;
