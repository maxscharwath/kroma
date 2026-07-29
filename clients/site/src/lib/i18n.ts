import { useRouterState } from '@tanstack/react-router';

// The site ships in several languages. The DEFAULT locale (English) lives at the
// clean root (`/`, `/download`); every other locale is prefixed by its code
// (`/fr`, `/fr/download`). The locale is a pure function of the pathname, no
// cookie, no state, which is exactly what a prerendered static site needs: the
// language is known at build time from the URL alone, so each locale gets its own
// HTML file. Adding a language is one entry in `locales` (plus its message
// catalog) and this logic already handles the routing for it.

export const locales = ['en', 'fr'] as const;
export type Lang = (typeof locales)[number];
export const defaultLocale: Lang = 'en';

/** Human names for the language switcher. */
export const localeNames: Record<Lang, string> = { en: 'English', fr: 'Français' };
/** Short codes shown in the compact switcher. */
export const localeShort: Record<Lang, string> = { en: 'EN', fr: 'FR' };

const isLang = (s: string): s is Lang => (locales as readonly string[]).includes(s);

/** The locale a pathname belongs to: the first segment when it is a non-default
 *  locale code (`/fr/blog` → `fr`), otherwise the default (`/blog` → `en`). */
export function langFromPath(pathname: string): Lang {
  const seg = pathname.split('/')[1] ?? '';
  return isLang(seg) && seg !== defaultLocale ? seg : defaultLocale;
}

/** Strip the locale prefix to the canonical (default-locale) path: `/fr/blog` → `/blog`. */
export function canonicalPath(pathname: string): string {
  const lang = langFromPath(pathname);
  if (lang === defaultLocale) return pathname || '/';
  return pathname.slice(lang.length + 1) || '/';
}

/** Add a locale's prefix to a canonical path: `('/blog', 'fr')` → `/fr/blog`;
 *  the default locale stays unprefixed. */
export function localizePath(path: string, lang: Lang): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === defaultLocale) return clean;
  return clean === '/' ? `/${lang}` : `/${lang}${clean}`;
}

/** The current locale, derived from the active pathname. Safe during SSR/prerender. */
export function useLang(): Lang {
  return useRouterState({ select: (s) => langFromPath(s.location.pathname) });
}

/** The current pathname, canonicalised (no locale prefix), for the language
 *  switcher, which must swap the prefix while keeping the reader on the same page. */
export function useCanonicalPath(): string {
  return useRouterState({ select: (s) => canonicalPath(s.location.pathname) });
}
