import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CATALOGS = fileURLToPath(new URL('../../core/src/locales/', import.meta.url));

function catalog(locale: string): Record<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(`${CATALOGS}${locale}.json`, 'utf8'));
  if (!parsed || typeof parsed !== 'object') throw new Error(`${locale}: not a catalog`);
  return parsed as Record<string, string>;
}

export function locales(): string[] {
  return readdirSync(CATALOGS)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''));
}

/**
 * What the app calls `key` in `locale`, read from the catalog the app itself
 * ships. Throws on a key the catalog no longer has, so a renamed message fails
 * the run instead of quietly never matching anything on screen.
 */
export function message(locale: string, key: string): string {
  const text = catalog(locale)[key];
  if (!text) throw new Error(`${locale}: no message "${key}"`);
  return text;
}
