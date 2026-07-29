import { useRouterState } from '@tanstack/react-router';

// The site ships in two languages. French is the default and lives at the clean
// root (`/`, `/download`); English is prefixed (`/en`, `/en/download`). The locale
// is therefore a pure function of the pathname — no cookie, no state — which is
// exactly what a prerendered static site needs: the language is known at build
// time from the URL alone, so each locale gets its own HTML file.

export const locales = ['fr', 'en'] as const;
export type Lang = (typeof locales)[number];
export const defaultLocale: Lang = 'fr';

/** Human names for the language switcher. */
export const localeNames: Record<Lang, string> = { fr: 'Français', en: 'English' };
/** Short codes shown in the compact switcher. */
export const localeShort: Record<Lang, string> = { fr: 'FR', en: 'EN' };

/** The locale a pathname belongs to (`/en` and `/en/*` are English; all else French). */
export function langFromPath(pathname: string): Lang {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'fr';
}

/** Strip the locale prefix to the canonical (French) path: `/en/blog` → `/blog`. */
export function canonicalPath(pathname: string): string {
  if (pathname === '/en') return '/';
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  return pathname || '/';
}

/** Add a locale's prefix to a canonical path: `('/blog', 'en')` → `/en/blog`. */
export function localizePath(path: string, lang: Lang): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'fr') return clean;
  return clean === '/' ? '/en' : `/en${clean}`;
}

/** The current locale, derived from the active pathname. Safe during SSR/prerender. */
export function useLang(): Lang {
  return useRouterState({ select: (s) => langFromPath(s.location.pathname) });
}

/** The current pathname, canonicalised (no locale prefix) — for the language
 *  switcher, which must swap the prefix while keeping the reader on the same page. */
export function useCanonicalPath(): string {
  return useRouterState({ select: (s) => canonicalPath(s.location.pathname) });
}
