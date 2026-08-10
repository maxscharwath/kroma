import { webDocument, webWindow } from '#ui/lib/dom';
import { KROMA, KROMA_LIGHT, setTheme, type Theme } from './theme.ts';

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_COOKIE = 'kroma-theme';
export const THEME_EVENT = 'kroma-theme';

const MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export const isThemeMode = (v: unknown): v is ThemeMode =>
  typeof v === 'string' && (MODES as readonly string[]).includes(v);

/** The palette a mode resolves to right now. `system` is read through
 *  `matchMedia`, never through CSS: `prefers-color-scheme: light` also answers
 *  yes to a visitor who has expressed no preference, so it cannot be used to
 *  tell "wants light" from "has not said". */
export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return webWindow()?.matchMedia?.('(prefers-color-scheme: dark)').matches === false
    ? 'light'
    : 'dark';
}

export const themeFor = (mode: ThemeMode): Theme =>
  resolveMode(mode) === 'light' ? KROMA_LIGHT : KROMA;

export function readMode(cookie?: string): ThemeMode {
  const jar = cookie ?? webDocument()?.cookie ?? '';
  const found = jar.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]+)`))?.[1];
  return isThemeMode(found) ? found : 'system';
}

/**
 * Moves BOTH halves of the design system: `data-theme` for the CSS custom
 * properties, and the theme store for every component that resolves a colour in
 * JS. Moving one alone is how a page ends up painting dark cards on a light
 * ground.
 */
export function applyMode(mode: ThemeMode): void {
  setTheme(themeFor(mode));
  const root = webDocument()?.documentElement;
  if (root) root.dataset.theme = resolveMode(mode);
}

export function writeMode(mode: ThemeMode): void {
  const doc = webDocument();
  if (doc) doc.cookie = `${THEME_COOKIE}=${mode};path=/;max-age=31536000;samesite=lax`;
  applyMode(mode);
  // Anything rendering through the kit has to re-render for the swap to show;
  // the event is what a <ThemeProvider> higher up listens for.
  webWindow()?.dispatchEvent?.(new CustomEvent(THEME_EVENT, { detail: mode }));
}

/** Inlined in `<head>` so the document is stamped before first paint. Without
 *  it a stored choice arrives only at hydration and the page flashes. */
export const themeBootScript = `(()=>{try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]+)/),v=m&&m[1];if(v!=='light'&&v!=='dark'&&v!=='system')v='system';document.documentElement.dataset.theme=v==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):v}catch(e){}})()`;
