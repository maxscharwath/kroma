import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const KIT_SRC = fileURLToPath(new URL('../../ui/src', import.meta.url));
const CATALOG_DIR = fileURLToPath(new URL('../../core/src/locales/', import.meta.url));

const CALL = /\b(?:t|msg)\(\s*(['"`])([\w.]+)\1/g;
const PLURAL = /_(?:zero|one|two|few|many|other)$/;
const SOURCE = /\.(?:ts|tsx|js|jsx)$/;

function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) sources(full, out);
    else if (SOURCE.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Every catalog key the code under `roots` can ask for by name: the argument of
 * a literal `t('key')` or `msg('key')`. A key built at runtime is not one of
 * them, which is the whole precondition of {@link messageSubset}.
 */
export function messageKeysIn(roots: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const root of roots) {
    for (const file of sources(root)) {
      for (const [, , key] of readFileSync(file, 'utf8').matchAll(CALL)) {
        if (key) keys.add(key);
      }
    }
  }
  return keys;
}

/** Drop from a catalog every message no `keys` member can reach. A key's plural
 *  variants count as reached, and `lang.*` is always kept: locale detection
 *  matches a written language name against it. */
export function subsetCatalog(
  catalog: Record<string, string>,
  keys: ReadonlySet<string>,
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, message] of Object.entries(catalog)) {
    if (key.startsWith('lang.') || keys.has(key) || keys.has(key.replace(PLURAL, ''))) {
      kept[key] = message;
    }
  }
  return kept;
}

export interface MessageSubsetOptions {
  /** Source trees scanned for the keys to keep, on top of the design system's own. */
  roots?: readonly string[];
  /** Keys to keep whatever the scan found, for a caller that builds one at runtime. */
  keep?: readonly string[];
}

/**
 * Ship only the part of `@kroma/core`'s message catalogs the bundle can reach.
 *
 * Both languages are a static import of ~2000 messages each, so a site that
 * renders no application string of its own still carries every admin screen's
 * copy for the one label a dialog's close button reads.
 *
 * Only for a target whose every key is a literal: a key assembled at runtime
 * resolves to itself once its message is gone.
 */
export function messageSubset(options: MessageSubsetOptions = {}): Plugin {
  let keys: Set<string> | undefined;
  return {
    name: 'kroma:message-subset',
    enforce: 'pre',
    load(id) {
      const file = id.split('?')[0] ?? id;
      if (!file.startsWith(CATALOG_DIR) || !file.endsWith('.json')) return null;
      keys ??= new Set([
        ...messageKeysIn([KIT_SRC, ...(options.roots ?? [])]),
        ...(options.keep ?? []),
      ]);
      const catalog = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
      return JSON.stringify(subsetCatalog(catalog, keys));
    },
  };
}
