import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  catalogs,
  keysByNamespace,
  namespacesNamedIn,
  scanCatalogs,
  TYPES_FILE,
  writeCatalogTypes,
} from './index.ts';

const dirs: string[] = [];

function folder(files: Record<string, object>): string {
  const dir = mkdtempSync(join(tmpdir(), 'kroma-catalogs-'));
  dirs.push(dir);
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, JSON.stringify(content));
  }
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const TWO = {
  'en/about.json': { 'about.title': 'About' },
  'fr/about.json': { 'about.title': 'À propos' },
  'en/admin.json': { 'admin.title': 'Console' },
  'fr/admin.json': { 'admin.title': 'Console' },
};

const KEYS = new Map<string, string[]>([
  ['admin', ['admin.title', 'admin.count', 'admin.count_one']],
  ['pipeline', ['pipeline.t.loudness', 'pipeline.t.subtitles', 'pipeline.stats.title']],
  ['nav', ['nav.home']],
]);

interface Hooks {
  buildStart: (this: unknown) => void;
  resolveId: (this: unknown, id: string) => string | undefined;
  load: (this: unknown, id: string) => string | undefined;
  transform: (this: unknown, code: string, id: string) => { code: string } | undefined;
}

function plugin(dir: string, eager = false): Hooks {
  return catalogs({ dir, defaultLocale: 'fr', eager }) as unknown as Hooks;
}

const byPath = (a: { locale: string; namespace: string }, b: typeof a) =>
  `${a.locale}/${a.namespace}`.localeCompare(`${b.locale}/${b.namespace}`);

describe('scanCatalogs', () => {
  it('lists every file under a locale folder and nothing at the top level', () => {
    const dir = folder({ ...TWO, 'stray.json': {} });

    expect(scanCatalogs(dir).sort(byPath)).toEqual([
      { locale: 'en', namespace: 'about' },
      { locale: 'en', namespace: 'admin' },
      { locale: 'fr', namespace: 'about' },
      { locale: 'fr', namespace: 'admin' },
    ]);
  });
});

describe('keysByNamespace', () => {
  it('reads each namespace its keys from one locale', () => {
    const dir = folder(TWO);

    expect([...keysByNamespace(dir, 'fr').entries()].sort()).toEqual([
      ['about', ['about.title']],
      ['admin', ['admin.title']],
    ]);
  });
});

describe('writeCatalogTypes', () => {
  it('writes the declaration once and leaves it alone while nothing moved', () => {
    const dir = folder(TWO);

    const first = writeCatalogTypes(dir, 'fr');
    const second = writeCatalogTypes(dir, 'fr');

    expect([first.changed, second.changed]).toEqual([true, false]);
    const text = readFileSync(join(dir, TYPES_FILE), 'utf8');
    expect(text).toContain("import type adminMessages from './fr/admin.json';");
    expect(text).toContain("locale: 'en' | 'fr';");
  });

  it('rewrites the declaration when a namespace appears', () => {
    const dir = folder(TWO);
    writeCatalogTypes(dir, 'fr');

    writeFileSync(join(dir, 'fr/nav.json'), '{}');
    const again = writeCatalogTypes(dir, 'fr');

    expect(again.changed).toBe(true);
    expect(readFileSync(again.path, 'utf8')).toContain('nav: typeof navMessages;');
  });
});

describe('namespacesNamedIn', () => {
  it('names a namespace for a literal that is one of its keys, plural stems included', () => {
    expect(namespacesNamedIn("t('admin.title'); t('admin.count', { count })", KEYS)).toEqual([
      'admin',
    ]);
  });

  it('names a namespace for a template head that keys start with', () => {
    expect(namespacesNamedIn(`t(\`pipeline.t.\${stage}\`)`, KEYS)).toEqual(['pipeline']);
    expect(namespacesNamedIn("'pipeline.stats' + '.title'", KEYS)).toEqual(['pipeline']);
  });

  it('names nothing for a string that merely looks like a key', () => {
    const code = "emit('pipeline.progress'); import x from './nav.web'; 'see nav.home here'";

    expect(namespacesNamedIn(code, KEYS)).toEqual([]);
  });

  it('ignores a prefix that has no catalog', () => {
    expect(namespacesNamedIn("t('nope.x')", KEYS)).toEqual([]);
  });
});

describe('the plugin', () => {
  it('writes the types when a build starts', () => {
    const dir = folder(TWO);

    plugin(dir).buildStart.call(null);

    expect(existsSync(join(dir, TYPES_FILE))).toBe(true);
  });

  it('serves a namespace module with one loader per locale', () => {
    const dir = folder(TWO);
    const hooks = plugin(dir);
    hooks.buildStart.call(null);

    const id = hooks.resolveId.call(null, 'virtual:kroma-catalog/admin');
    const code = hooks.load.call(null, id ?? '');

    expect(code).toContain(
      `"en": () => import(${JSON.stringify(join(dir, 'en/admin.json'))}).then((m) => m.default)`,
    );
    expect(code).toContain('announceCatalogs("admin", {');
    expect(code).not.toContain('import catalog0');
    expect(hooks.load.call(null, '\0kroma-catalog:nope')).toBeUndefined();
  });

  it('bundles every locale into the namespace module when eager', () => {
    const dir = folder(TWO);
    const hooks = plugin(dir, true);
    hooks.buildStart.call(null);

    const code = hooks.load.call(null, '\0kroma-catalog:admin');

    expect(code).toContain(`import catalog0 from ${JSON.stringify(join(dir, 'en/admin.json'))};`);
    expect(code).toContain('announceCatalogs("admin", { "en": catalog0, "fr": catalog1 });');
  });

  it('appends an import of each named namespace to a source module and leaves the rest alone', () => {
    const dir = folder(TWO);
    const hooks = plugin(dir);
    hooks.buildStart.call(null);
    const source = "export const label = t('admin.title');";

    const out = hooks.transform.call(null, source, '/app/src/page.tsx');

    expect(out?.code).toBe(`${source}\nimport "virtual:kroma-catalog/admin";\n`);
    expect(
      hooks.transform.call(null, "const x = 'admin.nope';", '/app/src/other.ts'),
    ).toBeUndefined();
    expect(hooks.transform.call(null, source, '/app/node_modules/x/index.js')).toBeUndefined();
    expect(hooks.transform.call(null, source, join(dir, 'x.ts'))).toBeUndefined();
  });
});
