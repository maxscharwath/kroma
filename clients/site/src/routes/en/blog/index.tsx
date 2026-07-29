import { createFileRoute } from '@tanstack/react-router';
import { seo } from '#site/lib/seo';
import { BlogIndex } from '#site/routes/blog/index';

export const Route = createFileRoute('/en/blog/')({
  head: () => ({
    ...seo({
      lang: 'en',
      title: 'Blog',
      description: 'Design notes, technical choices and the making of KROMA.',
      path: '/blog',
    }),
  }),
  component: BlogIndex,
});
