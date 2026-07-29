import { site } from '#site/lib/site';

export interface SeoInput {
  title?: string;
  description?: string;
  /** Absolute or root-relative path this page lives at, for the canonical URL. */
  path?: string;
  /** Root-relative image path for the social card. */
  image?: string;
  /** `article` on blog posts, `website` everywhere else. */
  type?: 'website' | 'article';
}

/**
 * Build the `meta`/`links` a route hands to TanStack Start's <HeadContent>.
 * A page passes only what it changes; the brand suffix, the Open Graph and the
 * Twitter card are filled in here so every page ships a complete, consistent
 * social preview without repeating the boilerplate.
 */
export function seo({ title, description, path, image, type = 'website' }: SeoInput = {}) {
  const fullTitle = title ? `${title} · ${site.name}` : `${site.name} — ${site.tagline}`;
  const desc = description ?? site.description;
  const url = path ? `${site.url}${path}` : site.url;
  const card = image ?? '/og.png';
  const cardUrl = card.startsWith('http') ? card : `${site.url}${card}`;

  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: desc },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: site.name },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: desc },
      { property: 'og:url', content: url },
      { property: 'og:image', content: cardUrl },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: desc },
      { name: 'twitter:image', content: cardUrl },
    ],
    links: [{ rel: 'canonical', href: url }],
  };
}
