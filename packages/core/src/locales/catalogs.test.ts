import { hasUnresolvedRef, type Locale, type MessageKey, SCHEMA_KEY } from '@kroma/i18n';
import { describe, expect, it } from 'vitest';
import { i18n } from '../i18n';
import { catalogs, lazy } from './catalogs';

type Catalog = Record<string, string>;

interface GlobHost {
  glob(pattern: string, options: { eager: true; import: 'default' }): Record<string, Catalog>;
}

interface CatalogFile {
  readonly namespace: string;
  readonly locale: string;
  readonly catalog: Catalog;
}

// Written out in full and cast in place: Vite finds `import.meta.glob(...)` by
// matching the literal text, and this package keeps node's types out.
const ON_DISK = (import.meta as unknown as GlobHost).glob('./*/*.json', {
  eager: true,
  import: 'default',
});

const CATEGORY = /_(zero|one|two|few|many|other)$/;
const QUOTED_NAMESPACE = /\$t\(\s*([A-Za-z]+)\./g;
const LOCALES = Object.keys(catalogs);
const LAZY = Object.keys(lazy) as Array<keyof typeof lazy>;

const files: CatalogFile[] = Object.entries(ON_DISK).map(([path, catalog]) => {
  const [namespace, file] = path.slice('./'.length).split('/');
  return { namespace: namespace ?? '', locale: file?.replace(/\.json$/, '') ?? '', catalog };
});
const namespaces = [...new Set(files.map((file) => file.namespace))].sort();

function messageKeys(catalog: Catalog): string[] {
  return Object.keys(catalog).filter((key) => key !== SCHEMA_KEY);
}

function baseKeys(catalog: Catalog): string[] {
  return messageKeys(catalog).filter((key) => !CATEGORY.test(key));
}

function stemOf(key: string): string {
  const stem = key.replace(CATEGORY, '');
  return stem.includes('_') ? stem.slice(0, stem.lastIndexOf('_')) : stem;
}

function fileOf(namespace: string, locale: string): Catalog {
  return files.find((f) => f.namespace === namespace && f.locale === locale)?.catalog ?? {};
}

describe('the catalog files', () => {
  it('each hold only keys of the namespace they are named after', () => {
    const strays = files.flatMap(({ namespace, locale, catalog }) =>
      messageKeys(catalog)
        .filter((key) => !key.startsWith(`${namespace}.`))
        .map((key) => `${namespace}/${locale}.json: ${key}`),
    );

    expect(strays).toEqual([]);
  });

  it('exist for every locale in every namespace', () => {
    const missing = namespaces.flatMap((namespace) =>
      LOCALES.filter(
        (locale) => !files.some((f) => f.namespace === namespace && f.locale === locale),
      ).map((locale) => `${namespace}/${locale}.json`),
    );

    expect(missing).toEqual([]);
  });

  it('say the same things in every language', () => {
    const drift = namespaces.flatMap((namespace) => {
      const reference = new Set(baseKeys(fileOf(namespace, i18n.defaultLocale)));
      return LOCALES.flatMap((locale) => {
        const own = baseKeys(fileOf(namespace, locale));
        return [
          ...own.filter((key) => !reference.has(key)).map((key) => `${locale} adds ${key}`),
          ...[...reference]
            .filter((key) => !own.includes(key))
            .map((key) => `${locale} lacks ${key}`),
        ];
      });
    });

    expect(drift).toEqual([]);
  });

  it('back every plural variant with a base key in the same file', () => {
    const orphans = files.flatMap(({ namespace, locale, catalog }) =>
      Object.keys(catalog)
        .filter((key) => CATEGORY.test(key) && catalog[stemOf(key)] === undefined)
        .map((key) => `${namespace}/${locale}.json: ${key}`),
    );

    expect(orphans).toEqual([]);
  });
});

describe('the catalog index', () => {
  it('ships every namespace on disk, eagerly or lazily, and nothing else', () => {
    const eager: Record<string, Catalog> = Object.fromEntries(LOCALES.map((l) => [l, {}]));
    for (const { namespace, locale, catalog } of files) {
      if (LAZY.includes(namespace as (typeof LAZY)[number])) continue;
      Object.assign(eager[locale] ?? {}, catalog);
    }

    const indexed = new Set<string>([
      ...Object.keys(catalogs[i18n.defaultLocale] ?? {}).map((key) =>
        key.slice(0, key.indexOf('.')),
      ),
      ...LAZY,
    ]);

    expect([...indexed].sort()).toEqual(namespaces);
    expect(catalogs).toEqual(eager);
  });

  it('never quotes a lazy namespace from an eager one', () => {
    const crossings = files
      .filter(({ namespace }) => !LAZY.includes(namespace as (typeof LAZY)[number]))
      .flatMap(({ namespace, locale, catalog }) =>
        Object.entries(catalog).flatMap(([key, template]) =>
          [...template.matchAll(QUOTED_NAMESPACE)]
            .filter((match) => LAZY.includes(match[1] as (typeof LAZY)[number]))
            .map(() => `${namespace}/${locale}.json: ${key}`),
        ),
      );

    expect(crossings).toEqual([]);
  });

  it('resolves every $t() reference it writes, lazy namespaces included', async () => {
    await i18n.load(...LAZY);

    const dangling = files.flatMap(({ locale, catalog }) =>
      messageKeys(catalog).filter((key) =>
        hasUnresolvedRef(i18n.translate(locale as Locale, key as MessageKey)),
      ),
    );

    expect(dangling).toEqual([]);
  });
});
