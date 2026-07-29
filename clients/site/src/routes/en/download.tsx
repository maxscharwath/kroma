import { createFileRoute } from '@tanstack/react-router';
import { seo } from '#site/lib/seo';
import { Download } from '#site/routes/download';

export const Route = createFileRoute('/en/download')({
  head: () => ({ ...seo({ lang: 'en', title: 'Install', path: '/download' }) }),
  component: Download,
});
