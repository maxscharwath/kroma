import { IconShieldLock } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import { ContactCard } from '#site/components/contact/contact-card';
import { Container } from '#site/components/container';
import { seo } from '#site/lib/seo';
import { site } from '#site/lib/site';

export const Route = createFileRoute('/privacy')({
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

// Kept short and honest on purpose: KROMA holds almost no personal data because
// there is almost nothing to hold, no accounts on the site, no cloud behind the
// app. The one component that touches a service we operate (the push relay) is
// named plainly rather than buried, because pretending it doesn't exist would be
// the dishonest choice.
export function Privacy() {
  return (
    <Container size="prose">
      <article className="py-16 sm:py-20">
        <header>
          <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Confidentialité
          </p>
          <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.08] text-text sm:text-5xl">
            Politique de confidentialité
          </h1>
          <p className="mt-5 text-sm text-dim">Dernière mise à jour : 29 juillet 2026</p>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            KROMA est un logiciel libre que vous hébergez vous-même, et {site.domain} n’est qu’une
            vitrine. En clair : ce site ne collecte presque rien, et ce que fait l’application reste
            sur votre matériel, sur votre réseau.
          </p>
        </header>

        <div className="mt-12 h-px bg-border" />

        <div className="prose-kroma mt-12">
          <h2>En bref</h2>
          <ul>
            <li>
              Aucun compte, aucun traceur publicitaire, aucun cookie de mesure d’audience sur ce
              site.
            </li>
            <li>
              L’application tourne chez vous : votre médiathèque, vos comptes et votre historique de
              lecture ne quittent jamais votre réseau. Il n’existe pas de « cloud KROMA ».
            </li>
            <li>
              Une seule exception, assumée : les notifications push transitent par un relais que
              nous opérons sur Cloudflare, il transmet des notifications, jamais vos médias ni votre
              bibliothèque.
            </li>
          </ul>

          <h2>Ce que ce site collecte</h2>
          <p>
            {site.domain} est un site statique, hébergé sur le réseau de Cloudflare. Il n’a ni
            compte utilisateur, ni formulaire d’inscription, ni outil de mesure d’audience, ni régie
            publicitaire. Nous ne déposons aucun cookie de suivi et n’exécutons aucun script de
            traçage.
          </p>
          <p>
            Comme tout site, il génère des <strong>journaux techniques</strong> ordinaires côté
            serveur et CDN (adresse IP, agent utilisateur, page demandée, horodatage). Cloudflare
            les traite pour livrer les pages, absorber les attaques et assurer la sécurité du
            service. Ces journaux sont éphémères et ne servent ni à vous profiler, ni à vous
            recontacter.
          </p>

          <h2>Ce que l’application collecte (rien qui quitte votre réseau)</h2>
          <p>
            L’application KROMA s’exécute sur du matériel que vous possédez, votre NAS, un hôte
            Docker, un Raspberry Pi. Votre bibliothèque, vos fichiers, vos comptes et profils, votre
            historique de lecture et vos statistiques y sont stockés <strong>localement</strong> et
            n’en sortent pas. Nous n’y avons aucun accès, et aucune télémétrie ne nous est renvoyée
            : il n’existe pas de service central vers lequel remonter quoi que ce soit.
          </p>
          <p>
            Pour ces données, c’est vous, l’opérateur du serveur, qui en avez la maîtrise complète.
            Vous décidez qui y accède, où elles résident et quand les effacer.
          </p>

          <h2>Notifications push via le relais Cloudflare</h2>
          <p>
            C’est le seul composant qui touche un service que nous opérons, et nous préférons le
            dire franchement. Les applications mobile et TV peuvent recevoir des{' '}
            <strong>notifications push</strong> (par exemple « votre téléchargement est prêt »).
            Apple et Google exigent pour cela des identifiants confidentiels qui ne peuvent pas
            vivre dans un code source public et auto-hébergé. Ils sont donc détenus par un petit{' '}
            <strong>relais</strong> (« push relay ») que nous exécutons sur Cloudflare.
          </p>
          <p>
            Ce relais reçoit le jeton de notification de votre appareil (fourni par Apple ou Google)
            et le message à afficher, puis les transmet au service push du fabricant. Il{' '}
            <strong>ne voit pas</strong>, et ne transporte pas, vos médias, votre bibliothèque, ni
            votre historique. Si vous n’activez pas les notifications, rien ne transite par lui.
          </p>

          <h2>Cookies</h2>
          <p>
            Ce site n’utilise aucun cookie de mesure d’audience ou de publicité, il n’y a donc pas
            de bandeau de consentement, parce qu’il n’y a rien à consentir. Cloudflare peut poser un
            cookie strictement nécessaire à la sécurité (protection anti-abus) ; il ne sert pas à
            vous suivre d’un site à l’autre.
          </p>

          <h2>Services tiers</h2>
          <p>
            <strong>Cloudflare</strong> héberge ce site et le relais de notifications ; à ce titre
            il traite les journaux techniques évoqués plus haut. Les métadonnées de films et séries
            proviennent de <strong>TMDB</strong>, mais c’est <em>votre</em> serveur qui les
            interroge, sur votre réseau, pas nous.
          </p>

          <h2>Vos droits</h2>
          <p>
            Nous ne détenons quasiment aucune donnée personnelle vous concernant : il y a donc très
            peu de matière sur laquelle exercer un droit d’accès, de rectification ou d’effacement
            du côté de {site.domain}. Si vous pensez que nous détenons malgré tout une information
            vous concernant, écrivez-nous et nous y donnerons suite.
          </p>
          <p>
            Pour les données de l’application, elles vivent sur votre installation : vous les
            consultez, les corrigez et les supprimez directement, sans passer par nous.
          </p>

          <h2>Contact</h2>
          <p>
            Une question sur cette politique ou sur vos données ? Écrivez à{' '}
            <a href={`mailto:${site.email.privacy}`}>{site.email.privacy}</a>.
          </p>
          <p>
            Cette politique peut évoluer si le site change ; la date de dernière mise à jour en haut
            de page fait foi.
          </p>
        </div>

        {/* A real contact affordance to close on, rather than a bare mailto in a
            paragraph, the same channel, made unmissable. */}
        <div className="mt-14">
          <ContactCard
            icon={IconShieldLock}
            title="Questions de confidentialité"
            description="Écrivez-nous pour toute question sur cette politique ou sur vos données."
            action={site.email.privacy}
            href={`mailto:${site.email.privacy}`}
          />
        </div>
      </article>
    </Container>
  );
}
