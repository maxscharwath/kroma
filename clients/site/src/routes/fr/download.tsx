import { createFileRoute } from '@tanstack/react-router';
import { seo } from '#site/lib/seo';
import { Download } from '#site/routes/download';

export const Route = createFileRoute('/fr/download')({
  head: () => ({ ...seo({ lang: 'fr', title: 'Installer', path: '/download' }) }),
  component: Download,
});
