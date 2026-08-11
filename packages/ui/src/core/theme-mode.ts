import { deviceStorage } from '@kroma/core';
import { Appearance, Platform } from 'react-native';
import { webDocument } from '#ui/lib/dom';
import { KROMA, KROMA_LIGHT, setTheme } from './theme.ts';
import { CSS_COLORS } from './tokens/css-palette.ts';

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_COOKIE = 'kroma-theme';

const THEME_KEY = 'kroma:theme';

const MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export const isThemeMode = (v: unknown): v is ThemeMode =>
  typeof v === 'string' && (MODES as readonly string[]).includes(v);

// A browser keeps the choice in a cookie because the SERVER has to read it, and
// stamps the ground on the document before the page is sent. A native app has
// no server and no cookie jar, so it keeps it beside its other device
// preferences. One file keyed on the platform rather than a `.web.ts` pair, for
// the reason css-palette gives: both halves are legal values, so a resolution
// that fell through to the wrong one would be silent.
const WEB = Platform.OS === 'web';

const COOKIE = new RegExp(String.raw`(?:^|;\s*)${THEME_COOKIE}=([^;]+)`);

function stored(jar?: string): string | null {
  if (WEB) return COOKIE.exec(jar ?? webDocument()?.cookie ?? '')?.[1] ?? null;
  try {
    return deviceStorage()?.getItem(THEME_KEY) ?? null;
  } catch {
    return null; /* storage unavailable */
  }
}

function store(mode: ThemeMode): void {
  if (WEB) {
    const doc = webDocument();
    if (doc) doc.cookie = `${THEME_COOKIE}=${mode};path=/;max-age=31536000;samesite=lax`;
    return;
  }
  try {
    deviceStorage()?.setItem(THEME_KEY, mode);
  } catch {
    /* storage unavailable */
  }
}

/** The ground a mode resolves to right now. `system` is the operating system's
 *  own answer, which react-native-web reads from `prefers-color-scheme` and a
 *  native target from the platform. Anything it cannot tell reads as dark,
 *  which is the product's default ground. */
export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

export function readMode(cookie?: string): ThemeMode {
  const found = stored(cookie);
  return isThemeMode(found) ? found : 'system';
}

/**
 * Stamps the ground on the document, which on a browser is the whole switch.
 *
 * Every colour the kit compiles there is a custom property, so redefining the
 * properties under `[data-theme]` repaints the page: nothing re-renders, no
 * second stylesheet loads, and the classes on every element are the ones that
 * were already there. `system` is stamped as ABSENCE, so the token sheet's
 * `prefers-color-scheme` rules answer it and keep following the operating
 * system while the page is open.
 *
 * React Native has no cascade to redefine anything in, so on a native target
 * the store is moved instead and `<ThemeProvider>` renders the tree again.
 */
export function applyMode(mode: ThemeMode): void {
  const root = webDocument()?.documentElement;
  if (root) {
    if (mode === 'system') delete root.dataset.theme;
    else root.dataset.theme = mode;
  }
  if (!CSS_COLORS) setTheme(resolveMode(mode) === 'light' ? KROMA_LIGHT : KROMA);
}

export function writeMode(mode: ThemeMode): void {
  store(mode);
  applyMode(mode);
}
