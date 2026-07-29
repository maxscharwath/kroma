import { createFileRoute } from '@tanstack/react-router';
import { blog } from '#site/lib/messages/blog';
import { seo } from '#site/lib/seo';
import { BlogIndex } from '#site/routes/blog/index';

// The French mirror of /blog: same component, French <head>. A route's `head` runs
// outside React, so it reads the catalog's locale directly rather than via the hook.
export const Route = createFileRoute('/fr/blog/')({
  head: () => seo({ lang: 'fr', ...blog.fr.index.head, path: '/blog' }),
  component: BlogIndex,
});
