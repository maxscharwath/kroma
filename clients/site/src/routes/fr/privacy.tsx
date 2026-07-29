import { createFileRoute } from '@tanstack/react-router';
import { seo } from '#site/lib/seo';
import { Privacy } from '#site/routes/privacy';

export const Route = createFileRoute('/fr/privacy')({
  head: () => ({
    ...seo({
      lang: 'fr',
      title: 'Confidentialité',
      description:
        'Ce que collecte (ou non) kroma.tv et l’application KROMA : un site vitrine statique, un logiciel auto-hébergé, et le seul service que nous opérons, le relais de notifications push.',
      path: '/privacy',
    }),
  }),
  component: Privacy,
});
