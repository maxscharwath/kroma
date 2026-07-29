import { createFileRoute } from '@tanstack/react-router';
import { privacy } from '#site/lib/messages/privacy';
import { seo } from '#site/lib/seo';
import { Privacy } from '#site/routes/privacy';

// The French mirror of /privacy: same component, French <head>. A route's `head`
// runs outside React, so it reads the catalog's locale directly rather than
// through the hook.
export const Route = createFileRoute('/fr/privacy')({
  head: () => ({ ...seo({ lang: 'fr', ...privacy.fr.head, path: '/privacy' }) }),
  component: Privacy,
});
