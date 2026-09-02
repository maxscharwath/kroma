import type { CatalogPath } from './layout';

export interface CatalogTypesSource {
  readonly files: readonly CatalogPath[];
  /** The locale whose files type the keys: the complete one. */
  readonly defaultLocale: string;
}

const HEADER = `// Written by @kroma/i18n/vite from the catalog files beside it, and ignored by
// git. The Vite dev server refreshes it; \`bun run i18n:types\` does without one.
// Do not edit.`;

function pascal(word: string): string {
  return word.replace(/(?:^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, first: string) =>
    first.toUpperCase(),
  );
}

function binding(namespace: string): string {
  const upper = pascal(namespace);
  return `${upper.charAt(0).toLowerCase()}${upper.slice(1)}Messages`;
}

/**
 * The declaration that teaches `@kroma/i18n` a folder of catalogs: `Register`
 * gains the locales and every namespace's messages folded into one map, so
 * `MessageKey` covers the whole folder without a line of hand-written code.
 * Pure, so a test can render it without a disk; the Vite plugin scans and
 * writes.
 */
export function renderCatalogTypes({ files, defaultLocale }: CatalogTypesSource): string {
  const locales = [...new Set(files.map((file) => file.locale))].sort();
  if (!locales.includes(defaultLocale)) {
    throw new Error(`no catalog folder for the default locale "${defaultLocale}"`);
  }
  const namespaces = files
    .filter((file) => file.locale === defaultLocale)
    .map((file) => file.namespace)
    .sort();

  const lines = [HEADER, ''];
  for (const namespace of namespaces) {
    lines.push(`import type ${binding(namespace)} from './${defaultLocale}/${namespace}.json';`);
  }
  lines.push('', "declare module '@kroma/i18n' {", '  interface Register {');
  lines.push(`    locale: ${locales.map((locale) => `'${locale}'`).join(' | ')};`);
  lines.push('    messages:');
  namespaces.forEach((namespace, at) => {
    const tail = at === namespaces.length - 1 ? ';' : ' &';
    lines.push(`      typeof ${binding(namespace)}${tail}`);
  });
  lines.push('  }', '}');
  return `${lines.join('\n')}\n`;
}
