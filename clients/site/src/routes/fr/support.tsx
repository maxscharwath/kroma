import { createFileRoute } from '@tanstack/react-router';
import { support } from '#site/lib/messages/support';
import { seo } from '#site/lib/seo';
import { Support } from '#site/routes/support';

// The French mirror of /support: same component, French <head>. A route's `head`
// runs outside React, so it reads the catalog's locale directly rather than
// through the hook.
export const Route = createFileRoute('/fr/support')({
  head: () => ({ ...seo({ lang: 'fr', ...support.fr.head, path: '/support' }) }),
  component: Support,
});
