import { createFileRoute } from '@tanstack/react-router';
import { seo } from '#site/lib/seo';
import { Support } from '#site/routes/support';

export const Route = createFileRoute('/fr/support')({
  head: () => ({
    ...seo({
      lang: 'fr',
      title: 'Support',
      description:
        'Où obtenir de l’aide pour KROMA : par e-mail, sur GitHub, dans le guide d’installation et la documentation. Plus comment bien signaler un bug.',
      path: '/support',
    }),
  }),
  component: Support,
});
