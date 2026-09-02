import { fileURLToPath } from 'node:url';
import { catalogs } from '@kroma/i18n/vite';
import type { Plugin } from 'vite';
import { DEFAULT_LOCALE_CODE } from '../src/locales/default-locale.ts';

/** KROMA's message catalogs: one folder per locale, one file per namespace. */
export const CORE_LOCALES = fileURLToPath(new URL('../src/locales/', import.meta.url));

export interface KromaCatalogsOptions {
  /** Bundle every locale with the code instead of fetching the rendered one.
   *  For the test runner, where nothing should suspend. */
  eager?: boolean;
}

/** The catalog folder, wired into a Vite build: types kept in step in
 *  `src/locales/catalogs.d.ts`, and each namespace travelling with the code
 *  that names its keys, fetched in the rendered locale alone. Every Vite config
 *  that bundles `@kroma/core` loads it; Metro registers the folder itself and
 *  reads the types `bun run i18n:types` wrote. */
export function kromaCatalogs(options: KromaCatalogsOptions = {}): Plugin {
  return catalogs({ dir: CORE_LOCALES, defaultLocale: DEFAULT_LOCALE_CODE, eager: options.eager });
}
