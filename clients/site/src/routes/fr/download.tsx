import { createFileRoute } from '@tanstack/react-router';
import { download } from '#site/lib/messages/download';
import { seo } from '#site/lib/seo';
import { Download } from '#site/routes/download';

// The French mirror of /download: same component, French <head>. A route's `head`
// runs outside React, so it reads the catalog's locale directly rather than via
// the hook.
export const Route = createFileRoute('/fr/download')({
  head: () => seo({ lang: 'fr', ...download.fr.head, path: '/download' }),
  component: Download,
});
