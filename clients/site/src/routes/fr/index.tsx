import { createFileRoute } from '@tanstack/react-router';
import { seo } from '#site/lib/seo';
import { Home } from '#site/routes/index';

// The English home. It renders the same component as the French home; the page
// reads the active locale from the URL, so `/en` gets English copy and English
// head, while sharing one implementation.
export const Route = createFileRoute('/fr/')({
  head: () => ({ ...seo({ lang: 'fr', path: '/' }) }),
  component: Home,
});
