import type { ComponentType } from 'react';

// The blog is a folder of .mdx files under content/blog. One eager glob reads it
// at build time: each post's compiled component, its frontmatter (lifted to
// `export const frontmatter` by remark-mdx-frontmatter) and its `readingMinutes`
// (injected by the remark plugin in vite.config). Because it is all resolved at
// build, every post is available to the prerender with no runtime fetch, drop in
// a file, and it appears.

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
  title: string;
  date: string;
  /** Human date, e.g. "14 janvier 2026". */
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

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function slugOf(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.mdx$/, '');
}

function build(): Post[] {
  const posts = Object.entries(modules).map(([path, mod]): Post & { draft: boolean } => {
    const fm = mod.frontmatter ?? {};
    const slug = slugOf(path);
    const date = fm.date ?? '1970-01-01';
    return {
      slug,
      title: fm.title ?? slug,
      date,
      dateLabel: dateFmt.format(new Date(date)),
      excerpt: fm.excerpt ?? '',
      author: fm.author ?? 'L’équipe KROMA',
      tags: fm.tags ?? [],
      cover: fm.cover,
      readingMinutes: mod.readingMinutes ?? 1,
      draft: fm.draft ?? false,
      Component: mod.default,
    };
  });

  // Newest first; drafts are hidden in the production build only.
  return posts
    .filter((p) => import.meta.env.DEV || !p.draft)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(({ draft: _draft, ...post }) => post);
}

const posts = build();

export function getAllPosts(): Post[] {
  return posts;
}

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}
