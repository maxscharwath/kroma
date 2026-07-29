import { createFileRoute } from '@tanstack/react-router';
import { seo } from '#site/lib/seo';
import { Support } from '#site/routes/support';

export const Route = createFileRoute('/en/support')({
  head: () => ({ ...seo({ lang: 'en', title: 'Support', path: '/support' }) }),
  component: Support,
});
