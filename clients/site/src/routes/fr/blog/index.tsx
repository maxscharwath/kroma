import { createFileRoute } from '@tanstack/react-router';
import { seo } from '#site/lib/seo';
import { BlogIndex } from '#site/routes/blog/index';

export const Route = createFileRoute('/fr/blog/')({
  head: () => ({
    ...seo({
      lang: 'fr',
      title: 'Blog',
      description: 'Notes de conception, choix techniques et coulisses du développement de KROMA.',
      path: '/blog',
    }),
  }),
  component: BlogIndex,
});
