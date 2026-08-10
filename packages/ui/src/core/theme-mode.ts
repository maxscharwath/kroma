import { webDocument, webWindow } from '#ui/lib/dom';
import { KROMA, KROMA_LIGHT, setTheme } from './theme.ts';
import { CSS_COLORS } from './tokens/css-palette.ts';

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_COOKIE = 'kroma-theme';

const MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export const isThemeMode = (v: unknown): v is ThemeMode =>
  typeof v === 'string' && (MODES as readonly string[]).includes(v);

/** The ground a mode resolves to right now. `system` is read through
 *  `matchMedia`, never through CSS: `prefers-color-scheme: light` also answers
 *  yes to a visitor who has expressed no preference, so it cannot be used to
 *  tell "wants light" from "has not said". */
export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return webWindow()?.matchMedia?.('(prefers-color-scheme: dark)').matches === false
    ? 'light'
    : 'dark';
}

export function readMode(cookie?: string): ThemeMode {
  const jar = cookie ?? webDocument()?.cookie ?? '';
  const found = jar.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]+)`))?.[1];
  return isThemeMode(found) ? found : 'system';
}

/**
 * Stamps the ground on the document, which on a browser is the whole switch.
 *
 * Every colour the kit compiles there is a custom property, so redefining the
 * properties under `[data-theme]` repaints the page: nothing re-renders, no
 * second stylesheet loads, and the classes on every element are the ones that
 * were already there. React Native has no cascade to redefine anything in, so
 * on a native target the store is moved instead and `<ThemeProvider>` renders
 * the tree again.
 */
export function applyMode(mode: ThemeMode): void {
  const root = webDocument()?.documentElement;
  if (root) root.dataset.theme = resolveMode(mode);
  if (!CSS_COLORS) setTheme(resolveMode(mode) === 'light' ? KROMA_LIGHT : KROMA);
}

export function writeMode(mode: ThemeMode): void {
  const doc = webDocument();
  if (doc) doc.cookie = `${THEME_COOKIE}=${mode};path=/;max-age=31536000;samesite=lax`;
  applyMode(mode);
}

/** Inlined in `<head>` so the document is stamped before first paint. Without
 *  it a stored choice arrives only at hydration and the page flashes. */
export const themeBootScript = `(()=>{try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]+)/),v=m&&m[1];if(v!=='light'&&v!=='dark'&&v!=='system')v='system';document.documentElement.dataset.theme=v==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):v}catch(e){}})()`;
