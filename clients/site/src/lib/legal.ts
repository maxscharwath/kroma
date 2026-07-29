import type { ComponentType } from 'react';
import { type Lang, locales } from '#site/lib/i18n';

// The legal documents (today: the privacy policy) are MDX files, one per locale:
//
//   content/legal/privacy.en.mdx     the English text
//   content/legal/privacy.fr.mdx     the French text
//
// They are prose, not UI strings, so they do NOT belong in the Paraglide catalogs:
// a policy is a structured document with headings, lists, bold clauses and links,
// and it is reviewed as a whole rather than sentence by sentence. Markdown is the
// format a legal text should be edited in; a `.json` value is not.
//
// The convention is lib/blog's, minus the parts a two-file document does not need
// (no frontmatter, no dates, no drafts): an eager glob resolved at build time and
// keyed by locale, with a fallback to the base locale so a document whose
// translation has not been written yet still renders instead of leaving a legal
// page blank. Deliberately a separate, tiny module rather than a generalisation of
// the blog loader - the two share a naming convention, not a data shape.

/** The locale a `<name>.mdx` file with no `.lang` suffix is assumed to be in, and
 *  the version served when the requested locale has no translation. */
const FALLBACK_LANG: Lang = 'en';

interface LegalModule {
  default: ComponentType;
}

const modules = import.meta.glob<LegalModule>('../../content/legal/*.mdx', { eager: true });

const isLang = (s: string): s is Lang => (locales as readonly string[]).includes(s);

/** Parse `content/legal/privacy.fr.mdx` -> `{ name: 'privacy', lang: 'fr' }`. */
function parse(path: string): { name: string; lang: Lang } {
  const file =
    path
      .split('/')
      .pop()
      ?.replace(/\.mdx$/, '') ?? path;
  const parts = file.split('.');
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (last && isLang(last)) return { name: parts.slice(0, -1).join('.'), lang: last };
  return { name: file, lang: FALLBACK_LANG };
}

// name -> (lang -> component), built once from the glob.
const docs: Map<string, Partial<Record<Lang, ComponentType>>> = (() => {
  const map = new Map<string, Partial<Record<Lang, ComponentType>>>();
  for (const [path, mod] of Object.entries(modules)) {
    const { name, lang } = parse(path);
    const byLang = map.get(name) ?? {};
    byLang[lang] = mod.default;
    map.set(name, byLang);
  }
  return map;
})();

/**
 * The rendered component for a legal document in a locale: the translation when it
 * exists, the fallback-locale version otherwise, and `undefined` only when no file
 * for that name exists at all.
 */
export function getLegalDoc(name: string, lang: Lang): ComponentType | undefined {
  const byLang = docs.get(name);
  if (!byLang) return undefined;
  return byLang[lang] ?? byLang[FALLBACK_LANG] ?? Object.values(byLang)[0];
}
