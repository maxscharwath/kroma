import { type Lang, locales, localizePath } from '#site/lib/i18n';
import { site } from '#site/lib/site';

export interface SeoInput {
  /** The locale this head is for. Drives the canonical URL, the hreflang
   *  alternates and the og:locale. */
  lang: Lang;
  title?: string;
  description?: string;
  /** The CANONICAL (French) path, e.g. `/download`. The locale prefix is added
   *  here, and every locale's URL is emitted as an hreflang alternate. */
  path?: string;
  /** Root-relative image path for the social card. */
  image?: string;
  /** `article` on blog posts, `website` everywhere else. */
  type?: 'website' | 'article';
}

const ogLocale: Record<Lang, string> = { fr: 'fr_FR', en: 'en_US' };

/**
 * Build the `meta`/`links` a route hands to TanStack Start's <HeadContent>.
 * A page passes its locale and the bits it changes; the brand suffix, the Open
 * Graph, the Twitter card, the canonical URL and the per-locale hreflang
 * alternates are filled in here so every page ships a complete, consistent, and
 * correctly cross-linked social + SEO head without repeating the boilerplate.
 */
export function seo({ lang, title, description, path = '/', image, type = 'website' }: SeoInput) {
  const tagline = lang === 'fr' ? site.tagline : site.taglineEn;
  const fullTitle = title ? `${title} · ${site.name}` : `${site.name} · ${tagline}`;
  const desc = description ?? (lang === 'fr' ? site.description : site.descriptionEn);
  const url = `${site.url}${localizePath(path, lang)}`;
  const card = image ?? '/og.png';
  const cardUrl = card.startsWith('http') ? card : `${site.url}${card}`;

  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: desc },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: site.name },
      { property: 'og:locale', content: ogLocale[lang] },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: desc },
      { property: 'og:url', content: url },
      { property: 'og:image', content: cardUrl },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: desc },
      { name: 'twitter:image', content: cardUrl },
    ],
    links: [
      { rel: 'canonical', href: url },
      // Every locale points at every locale (Google needs the reciprocal set),
      // plus x-default at the French root.
      ...locales.map((l) => ({
        rel: 'alternate',
        hreflang: l,
        href: `${site.url}${localizePath(path, l)}`,
      })),
      { rel: 'alternate', hreflang: 'x-default', href: `${site.url}${localizePath(path, 'fr')}` },
    ],
  };
}
