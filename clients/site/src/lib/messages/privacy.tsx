import { useLang } from '#site/lib/i18n';
import { site } from '#site/lib/site';

// The privacy page in every locale. Both languages keep the page short and plain
// on purpose: KROMA holds almost no personal data because there is almost
// nothing to hold (no accounts on the site, no cloud behind the app). The one
// component that touches a service we operate, the Cloudflare push relay, is
// named openly rather than buried, because pretending it did not exist would be
// the dishonest choice. `prose` is a JSX fragment rather than a string because
// the legal text is structured (headings, lists, the contact mailto), and the
// whole block belongs here so the page itself holds nothing but keys.

export const privacy = {
  fr: {
    head: {
      title: 'Confidentialité',
      description:
        'Ce que collecte (ou non) kroma.tv et l’application KROMA : un site vitrine statique, un logiciel auto-hébergé, et le seul service que nous opérons, le relais de notifications push.',
    },
    eyebrow: 'Confidentialité',
    title: 'Politique de confidentialité',
    updated: 'Dernière mise à jour : 29 juillet 2026',
    intro: (
      <>
        KROMA est un logiciel libre que vous hébergez vous-même, et {site.domain} n’est qu’une
        vitrine. En clair : ce site ne collecte presque rien, et ce que fait l’application reste sur
        votre matériel, sur votre réseau.
      </>
    ),
    prose: (
      <>
        <h2>En bref</h2>
        <ul>
          <li>
            Aucun compte, aucun traceur publicitaire, aucun cookie de mesure d’audience sur ce site.
          </li>
          <li>
            L’application tourne chez vous : votre médiathèque, vos comptes et votre historique de
            lecture ne quittent jamais votre réseau. Il n’existe pas de « cloud KROMA ».
          </li>
          <li>
            Une seule exception, assumée : les notifications push transitent par un relais que nous
            opérons sur Cloudflare, il transmet des notifications, jamais vos médias ni votre
            bibliothèque.
          </li>
        </ul>

        <h2>Ce que ce site collecte</h2>
        <p>
          {site.domain} est un site statique, hébergé sur le réseau de Cloudflare. Il n’a ni compte
          utilisateur, ni formulaire d’inscription, ni outil de mesure d’audience, ni régie
          publicitaire. Nous ne déposons aucun cookie de suivi et n’exécutons aucun script de
          traçage.
        </p>
        <p>
          Comme tout site, il génère des <strong>journaux techniques</strong> ordinaires côté
          serveur et CDN (adresse IP, agent utilisateur, page demandée, horodatage). Cloudflare les
          traite pour livrer les pages, absorber les attaques et assurer la sécurité du service. Ces
          journaux sont éphémères et ne servent ni à vous profiler, ni à vous recontacter.
        </p>

        <h2>Ce que l’application collecte (rien qui quitte votre réseau)</h2>
        <p>
          L’application KROMA s’exécute sur du matériel que vous possédez, votre NAS, un hôte
          Docker, un Raspberry Pi. Votre bibliothèque, vos fichiers, vos comptes et profils, votre
          historique de lecture et vos statistiques y sont stockés <strong>localement</strong> et
          n’en sortent pas. Nous n’y avons aucun accès, et aucune télémétrie ne nous est renvoyée :
          il n’existe pas de service central vers lequel remonter quoi que ce soit.
        </p>
        <p>
          Pour ces données, c’est vous, l’opérateur du serveur, qui en avez la maîtrise complète.
          Vous décidez qui y accède, où elles résident et quand les effacer.
        </p>

        <h2>Notifications push via le relais Cloudflare</h2>
        <p>
          C’est le seul composant qui touche un service que nous opérons, et nous préférons le dire
          franchement. Les applications mobile et TV peuvent recevoir des{' '}
          <strong>notifications push</strong> (par exemple « votre téléchargement est prêt »). Apple
          et Google exigent pour cela des identifiants confidentiels qui ne peuvent pas vivre dans
          un code source public et auto-hébergé. Ils sont donc détenus par un petit{' '}
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
          Ce site n’utilise aucun cookie de mesure d’audience ou de publicité, il n’y a donc pas de
          bandeau de consentement, parce qu’il n’y a rien à consentir. Cloudflare peut poser un
          cookie strictement nécessaire à la sécurité (protection anti-abus) ; il ne sert pas à vous
          suivre d’un site à l’autre.
        </p>

        <h2>Services tiers</h2>
        <p>
          <strong>Cloudflare</strong> héberge ce site et le relais de notifications ; à ce titre il
          traite les journaux techniques évoqués plus haut. Les métadonnées de films et séries
          proviennent de <strong>TMDB</strong>, mais c’est <em>votre</em> serveur qui les interroge,
          sur votre réseau, pas nous.
        </p>

        <h2>Vos droits</h2>
        <p>
          Nous ne détenons quasiment aucune donnée personnelle vous concernant : il y a donc très
          peu de matière sur laquelle exercer un droit d’accès, de rectification ou d’effacement du
          côté de {site.domain}. Si vous pensez que nous détenons malgré tout une information vous
          concernant, écrivez-nous et nous y donnerons suite.
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
      </>
    ),
    card: {
      title: 'Questions de confidentialité',
      description: 'Écrivez-nous pour toute question sur cette politique ou sur vos données.',
    },
  },
  en: {
    head: {
      title: 'Privacy',
      description:
        'What kroma.tv and the KROMA app do (and do not) collect: a static marketing site, self-hosted software, and the one service we operate, the push-notification relay.',
    },
    eyebrow: 'Privacy',
    title: 'Privacy policy',
    updated: 'Last updated: July 29, 2026',
    intro: (
      <>
        KROMA is free software that you host yourself, and {site.domain} is only a showcase. In
        short: this site collects almost nothing, and what the app does stays on your own hardware,
        on your own network.
      </>
    ),
    prose: (
      <>
        <h2>In short</h2>
        <ul>
          <li>No account, no advertising tracker, no analytics cookie on this site.</li>
          <li>
            The app runs on your own hardware: your library, your accounts and your playback history
            never leave your network. There is no "KROMA cloud".
          </li>
          <li>
            One exception, openly stated: push notifications pass through a relay we operate on
            Cloudflare, it forwards notifications, never your media or your library.
          </li>
        </ul>

        <h2>What this site collects</h2>
        <p>
          {site.domain} is a static site, hosted on Cloudflare's network. It has no user accounts,
          no sign-up form, no analytics tool and no ad network. We set no tracking cookies and run
          no tracking scripts.
        </p>
        <p>
          Like any website, it produces ordinary <strong>technical logs</strong> on the server and
          CDN side (IP address, user agent, page requested, timestamp). Cloudflare processes them to
          deliver the pages, absorb attacks and keep the service secure. These logs are short-lived,
          and serve neither to profile you nor to contact you.
        </p>

        <h2>What the app collects (nothing that leaves your network)</h2>
        <p>
          The KROMA app runs on hardware you own, your NAS, a Docker host, a Raspberry Pi. Your
          library, your files, your accounts and profiles, your playback history and your statistics
          are stored there <strong>locally</strong> and do not leave it. We have no access to any of
          it, and no telemetry is sent back to us: there is no central service for anything to
          report to.
        </p>
        <p>
          For that data, it is you, the server's operator, who is in complete control. You decide
          who reaches it, where it lives and when to erase it.
        </p>

        <h2>Push notifications via the Cloudflare relay</h2>
        <p>
          This is the only component that touches a service we operate, and we would rather say so
          plainly. The mobile and TV apps can receive <strong>push notifications</strong> (for
          example, "your download is ready"). Apple and Google require confidential credentials for
          this, and those cannot live in public, self-hosted source code. They are therefore held by
          a small <strong>relay</strong> (a "push relay") that we run on Cloudflare.
        </p>
        <p>
          This relay receives your device's notification token (issued by Apple or Google) and the
          message to display, then forwards them to the vendor's push service. It{' '}
          <strong>does not see</strong>, and does not carry, your media, your library or your
          history. If you do not turn notifications on, nothing passes through it.
        </p>

        <h2>Cookies</h2>
        <p>
          This site uses no analytics or advertising cookies, so there is no consent banner, because
          there is nothing to consent to. Cloudflare may set a cookie strictly necessary for
          security (abuse protection); it is not used to follow you from one site to another.
        </p>

        <h2>Third-party services</h2>
        <p>
          <strong>Cloudflare</strong> hosts this site and the notification relay; on that basis it
          processes the technical logs mentioned above. Metadata for films and series comes from{' '}
          <strong>TMDB</strong>, but it is <em>your</em> server that queries it, on your network,
          not us.
        </p>

        <h2>Your rights</h2>
        <p>
          We hold almost no personal data about you: there is therefore very little on which to
          exercise a right of access, rectification or erasure on the {site.domain} side. If you
          nonetheless believe we hold some information about you, write to us and we will act on it.
        </p>
        <p>
          As for the app's data, it lives on your own installation: you view it, correct it and
          delete it directly, without going through us.
        </p>

        <h2>Contact</h2>
        <p>
          A question about this policy or about your data? Write to{' '}
          <a href={`mailto:${site.email.privacy}`}>{site.email.privacy}</a>.
        </p>
        <p>
          This policy may change if the site changes; the last-updated date at the top of the page
          is authoritative.
        </p>
      </>
    ),
    card: {
      title: 'Privacy questions',
      description: 'Write to us with any question about this policy or about your data.',
    },
  },
} as const;

/** The privacy page's copy for the active locale. */
export function usePrivacy() {
  return privacy[useLang()];
}
