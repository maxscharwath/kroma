import { useLang } from '#site/lib/i18n';

// Everything the blog list and a post page say around the MDX itself. Post
// titles, excerpts and dates come from the posts (see lib/blog); only the frame
// is translated here.

export const blog = {
  fr: {
    index: {
      head: {
        title: 'Blog',
        description:
          'Notes de conception, choix techniques et coulisses du développement de KROMA.',
      },
      eyebrow: 'Journal',
      heading: 'Le blog KROMA',
      intro:
        'Les décisions de conception, les choix techniques et les coulisses d’un serveur média écrit pour durer. Écrit en clair, sans langue de bois.',
      empty: 'Le premier article arrive bientôt.',
    },
    post: { back: 'Tous les articles' },
    by: 'Par',
    readingSuffix: 'min de lecture',
  },
  en: {
    index: {
      head: {
        title: 'Blog',
        description: 'Design notes, technical choices and the making of KROMA.',
      },
      eyebrow: 'Journal',
      heading: 'The KROMA blog',
      intro:
        'Design decisions, technical choices and the making of a media server built to last. Written plainly, no spin.',
      empty: 'The first article is coming soon.',
    },
    post: { back: 'All articles' },
    by: 'By',
    readingSuffix: 'min read',
  },
} as const;

/** The blog frame strings for the active locale. */
export function useBlogCopy() {
  return blog[useLang()];
}
