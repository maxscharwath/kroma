import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import MagicString from 'magic-string';
import type { Plugin } from 'vite';
import { renderCatalogTypes } from '../src/catalog-types.ts';
import { type CatalogPath, parseCatalogPath } from '../src/layout.ts';

export const TYPES_FILE = 'catalogs.d.ts';

const ANNOUNCE = fileURLToPath(new URL('../src/announce.ts', import.meta.url));
const VIRTUAL = 'virtual:kroma-catalog/';
const RESOLVED = '\0kroma-catalog:';
const SOURCE = /\.[cm]?[jt]sx?$/;
const KEY_LITERAL = /['"`]([A-Za-z][A-Za-z0-9]*\.[A-Za-z0-9_.-]*)/g;

/** Every `<locale>/<namespace>.json` under `dir`. Files at the top level, the
 *  types among them, are not catalogs. */
export function scanCatalogs(dir: string): CatalogPath[] {
  const files: CatalogPath[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of readdirSync(join(dir, entry.name))) {
      const at = parseCatalogPath(`${entry.name}/${file}`);
      if (at) files.push(at);
    }
  }
  return files;
}

/** The keys of every namespace, read from one locale's files. */
export function keysByNamespace(dir: string, locale: string): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  for (const file of scanCatalogs(dir)) {
    if (file.locale !== locale) continue;
    const parsed: unknown = JSON.parse(
      readFileSync(join(dir, locale, `${file.namespace}.json`), 'utf8'),
    );
    keys.set(file.namespace, Object.keys(parsed ?? {}));
  }
  return keys;
}

export interface CatalogsOptions {
  /** The catalog directory: one folder per locale, one file per namespace. */
  dir: string;
  /** The locale whose files type the keys and decide what a literal names. */
  defaultLocale: string;
  /** Bundle every locale's catalog with the code instead of fetching the
   *  rendered locale's on demand. For a test runner, where nothing should
   *  suspend; a shell leaves it off. */
  eager?: boolean;
}

export interface Written {
  readonly path: string;
  readonly changed: boolean;
}

/** Render the declaration for `dir` and write it only when its text moved. */
export function writeCatalogTypes(dir: string, defaultLocale: string): Written {
  const path = join(dir, TYPES_FILE);
  const next = renderCatalogTypes({ files: scanCatalogs(dir), defaultLocale });
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === next) return { path, changed: false };
  writeFileSync(path, next);
  return { path, changed: true };
}

function within(root: string, file: string): boolean {
  return file.startsWith(root + sep);
}

function names(literal: string, keys: readonly string[]): boolean {
  if (literal.endsWith('.')) return keys.some((key) => key.startsWith(literal));
  return keys.some((key) => key === literal || key.startsWith(`${literal}.`));
}

/** The namespaces a module reads, judged by its string literals: `'admin.title'`
 *  names `admin` because that key exists, `` `pipeline.t.${stage}` `` names
 *  `pipeline` because keys start with `pipeline.t.`, and `'pipeline.stats'`
 *  names nothing when no such key exists. */
export function namespacesNamedIn(
  code: string,
  keys: ReadonlyMap<string, readonly string[]>,
): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(KEY_LITERAL)) {
    const literal = match[1] ?? '';
    const namespace = literal.slice(0, literal.indexOf('.'));
    if (found.has(namespace)) continue;
    const own = keys.get(namespace);
    if (own && names(literal, own)) found.add(namespace);
  }
  return [...found].sort();
}

/** The module that hands a namespace to the engine: a loader per locale, so
 *  only the rendered locale is fetched, or the catalogs themselves when eager. */
export function renderNamespaceModule(
  root: string,
  namespace: string,
  files: readonly CatalogPath[],
  eager: boolean,
): string {
  const own = files.filter((file) => file.namespace === namespace);
  const path = (file: CatalogPath) =>
    JSON.stringify(join(root, file.locale, `${file.namespace}.json`));
  const lines = [`import { announceCatalogs } from ${JSON.stringify(ANNOUNCE)};`];
  const entries = own.map((file, at) => {
    if (!eager)
      return `${JSON.stringify(file.locale)}: () => import(${path(file)}).then((m) => m.default)`;
    lines.push(`import catalog${at} from ${path(file)};`);
    return `${JSON.stringify(file.locale)}: catalog${at}`;
  });
  lines.push(`announceCatalogs(${JSON.stringify(namespace)}, { ${entries.join(', ')} });`);
  return `${lines.join('\n')}\n`;
}

/**
 * Catalogs discovered from a folder, wired two ways.
 *
 * Types: `<dir>/catalogs.d.ts` is rewritten at build start and, under the dev
 * server, whenever a catalog file appears or disappears. It augments the
 * registry, so a namespace is known to the type checker the moment its file
 * exists.
 *
 * Code: every source module whose string literals name a key gets an import of
 * that key's namespace appended, so the namespace travels in the chunk graph of
 * the code that reads it. The imported module hands the engine one loader per
 * locale; the engine fetches the rendered locale's the moment the chunk
 * evaluates, and `useT` waits for it. Nothing is fetched for a language nobody
 * is reading, and nothing at runtime for a key the source names.
 */
export function catalogs({ dir, defaultLocale, eager = false }: CatalogsOptions): Plugin {
  const root = resolve(dir);
  let files: CatalogPath[] = [];
  let keys = new Map<string, string[]>();
  const rescan = () => {
    files = scanCatalogs(root);
    keys = keysByNamespace(root, defaultLocale);
    writeCatalogTypes(root, defaultLocale);
  };
  const isCatalog = (file: string) => within(root, file) && file.endsWith('.json');
  const isSource = (id: string) => {
    const [file = ''] = id.split('?');
    if (id.startsWith('\0') || !SOURCE.test(file) || file.endsWith('.d.ts')) return false;
    return !file.includes(`${sep}node_modules${sep}`) && !within(root, file);
  };

  return {
    name: 'kroma:catalogs',
    // After the router's code splitter: a route file is cut into an eagerly
    // imported reference and a lazy component, and the literals live in the
    // component. Appending before the cut would put every route's catalogs in
    // the entry.
    enforce: 'post',
    buildStart() {
      rescan();
    },
    configureServer(server) {
      server.watcher.add(root);
      const onCatalog = (file: string) => {
        if (isCatalog(file)) rescan();
      };
      server.watcher.on('add', onCatalog);
      server.watcher.on('unlink', onCatalog);
      server.watcher.on('change', onCatalog);
    },
    resolveId(id) {
      return id.startsWith(VIRTUAL) ? RESOLVED + id.slice(VIRTUAL.length) : undefined;
    },
    load(id) {
      if (!id.startsWith(RESOLVED)) return undefined;
      const namespace = id.slice(RESOLVED.length);
      if (!keys.has(namespace)) return undefined;
      return renderNamespaceModule(root, namespace, files, eager);
    },
    transform(code, id) {
      if (!isSource(id)) return undefined;
      if (keys.size === 0) rescan();
      const named = namespacesNamedIn(code, keys);
      if (named.length === 0) return undefined;
      const patched = new MagicString(code);
      const imports = named.map((namespace) => `import ${JSON.stringify(VIRTUAL + namespace)};`);
      patched.append(`\n${imports.join('\n')}\n`);
      return { code: patched.toString(), map: patched.generateMap({ hires: true }) };
    },
  };
}
