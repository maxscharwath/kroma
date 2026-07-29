import { createFileRoute } from '@tanstack/react-router';
import { seo } from '#site/lib/seo';
import { Privacy } from '#site/routes/privacy';

export const Route = createFileRoute('/en/privacy')({
  head: () => ({ ...seo({ lang: 'en', title: 'Privacy', path: '/privacy' }) }),
  component: Privacy,
});
