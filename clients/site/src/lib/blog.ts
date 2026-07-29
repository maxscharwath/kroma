import type { ComponentType } from 'react';
import { type Lang, locales } from '#site/lib/i18n';

// The blog is a folder of .mdx files with a smart per-file language convention:
//
//   content/blog/my-post.mdx        the DEFAULT version (the fallback)
//   content/blog/my-post.fr.mdx     the French translation of that same post
//
// A post is keyed by its SLUG (`my-post`), shared across languages, so the URL
// and the language switcher line up (/blog/my-post <-> /en/blog/my-post). For a
// requested locale we serve `<slug>.<lang>.mdx` when it exists and fall back to
// `<slug>.mdx` otherwise: a reader ALWAYS gets the post, translated where a
// translation was written, in the default language where it was not. Nothing is
// ever hidden for lack of a translation.
//
// Everything is resolved from an eager glob at build time, so every post is
// available to the prerender with no runtime fetch. Drop in a file and it appears.

// The language of a `<slug>.mdx` file with no `.lang` suffix, and the fallback a
// reader sees when their language has no translation. Deliberately ENGLISH, and
// deliberately independent of the site's default UI locale (French, the clean
// root): a post is authored once in English as `my-post.mdx`, then translated
// as `my-post.fr.mdx`, and a French reader falls back to the English default
// until that translation exists — never a missing page.
const FALLBACK_LANG: Lang = 'en';

interface RawFrontmatter {
  title?: string;
  date?: string;
  excerpt?: string;
  author?: string;
  tags?: string[];
  cover?: string;
  draft?: boolean;
}

interface MdxModule {
  default: ComponentType<{ components?: Record<string, ComponentType> }>;
  frontmatter?: RawFrontmatter;
  readingMinutes?: number;
}

export interface PostMeta {
  slug: string;
  /** The language actually served (the requested one, or the fallback). */
  lang: Lang;
  /** True when a translation for the requested language existed; false when the
   *  reader is seeing the fallback-language version. */
  translated: boolean;
  title: string;
  date: string;
  dateLabel: string;
  excerpt: string;
  author: string;
  tags: string[];
  cover?: string;
  readingMinutes: number;
}

export interface Post extends PostMeta {
  Component: MdxModule['default'];
}

const modules = import.meta.glob<MdxModule>('../../content/blog/*.mdx', { eager: true });

const dateFmt: Record<Lang, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
  en: new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
};

const isLang = (s: string): s is Lang => (locales as readonly string[]).includes(s);

/** Parse `content/blog/my-post.fr.mdx` -> `{ slug: 'my-post', lang: 'fr' }`, and
 *  `content/blog/my-post.mdx` -> `{ slug: 'my-post', lang: FALLBACK_LANG }`. */
function parse(path: string): { slug: string; lang: Lang } {
  const name =
    path
      .split('/')
      .pop()
      ?.replace(/\.mdx$/, '') ?? path;
  const parts = name.split('.');
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (last && isLang(last)) {
    return { slug: parts.slice(0, -1).join('.'), lang: last };
  }
  return { slug: name, lang: FALLBACK_LANG };
}

// slug -> (lang -> module), the raw grouping the resolver reads from.
interface Group {
  slug: string;
  byLang: Partial<Record<Lang, MdxModule>>;
}

const groups: Map<string, Group> = (() => {
  const map = new Map<string, Group>();
  for (const [path, mod] of Object.entries(modules)) {
    const { slug, lang } = parse(path);
    const group = map.get(slug) ?? { slug, byLang: {} };
    group.byLang[lang] = mod;
    map.set(slug, group);
  }
  return map;
})();

/** Resolve a slug for a language: the translation if present, else the fallback,
 *  else any version that exists. Missing frontmatter fields on a translation are
 *  inherited from the fallback file, so a `.fr.mdx` can carry only what changed. */
function resolve(group: Group, lang: Lang): Post | undefined {
  const translated = Boolean(group.byLang[lang]);
  const mod = group.byLang[lang] ?? group.byLang[FALLBACK_LANG] ?? Object.values(group.byLang)[0];
  if (!mod) return undefined;
  const base = group.byLang[FALLBACK_LANG]?.frontmatter ?? {};
  const fm = { ...base, ...(mod.frontmatter ?? {}) };
  const date = fm.date ?? '1970-01-01';
  return {
    slug: group.slug,
    lang,
    translated,
    title: fm.title ?? group.slug,
    date,
    dateLabel: dateFmt[lang].format(new Date(date)),
    excerpt: fm.excerpt ?? '',
    author: fm.author ?? 'KROMA',
    tags: fm.tags ?? [],
    cover: fm.cover,
    readingMinutes: mod.readingMinutes ?? 1,
    Component: mod.default,
  };
}

/** Every post for a language (newest first). A post whose only version is a draft
 *  is hidden in the production build. */
export function getAllPosts(lang: Lang): Post[] {
  const posts: Post[] = [];
  for (const group of groups.values()) {
    const post = resolve(group, lang);
    if (!post) continue;
    const isDraft = (group.byLang[lang] ?? group.byLang[FALLBACK_LANG])?.frontmatter?.draft;
    if (!import.meta.env.DEV && isDraft) continue;
    posts.push(post);
  }
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** One post by slug for a language, with the same translation fallback. */
export function getPost(slug: string, lang: Lang): Post | undefined {
  const group = groups.get(slug);
  return group ? resolve(group, lang) : undefined;
}
