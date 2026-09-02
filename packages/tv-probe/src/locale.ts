import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CATALOGS = fileURLToPath(new URL('../../core/src/locales/', import.meta.url));

function namespaces(): string[] {
  return readdirSync(CATALOGS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function catalog(locale: string): Map<string, unknown> {
  const merged = new Map<string, unknown>();
  for (const namespace of namespaces()) {
    let raw: string;
    try {
      raw = readFileSync(`${CATALOGS}${namespace}/${locale}.json`, 'utf8');
    } catch {
      continue;
    }
    const parsed: unknown = JSON.parse(raw);
    for (const [key, text] of Object.entries(parsed ?? {})) merged.set(key, text);
  }
  return merged;
}

export function locales(): string[] {
  const codes = new Set<string>();
  for (const namespace of namespaces()) {
    for (const file of readdirSync(`${CATALOGS}${namespace}`)) {
      if (file.endsWith('.json')) codes.add(file.replace(/\.json$/, ''));
    }
  }
  return [...codes].sort();
}

/**
 * What the app calls `key` in `locale`, read from the catalog the app itself
 * ships. Throws on a key the catalog no longer has, so a renamed message fails
 * the run instead of quietly never matching anything on screen.
 */
export function message(locale: string, key: string): string {
  const text = catalog(locale).get(key);
  if (typeof text !== 'string') throw new Error(`${locale}: no message "${key}"`);
  return text;
}
