import type { ReactNode } from 'react';
import { useLang } from '#site/lib/i18n';
import { site } from '#site/lib/site';

// Everything the install page says, in both languages. The components hold keys
// only, so adding a language is one entry here and nothing else. What is NOT in
// here on purpose: shell commands, the compose file, ports, artifact extensions,
// device names (Samsung, macOS, Steam Deck), icons and layout classes are
// language-neutral and stay at the call site. React fragments are safe at module
// scope: they carry no per-render state, so building them once is correct. The
// `fr`/`en` shapes are structurally checked against each other by every
// `download[useLang()]` access.

/** The off-site destinations this page links to. They live beside the copy because
 *  the translated prose links to them inline; the sections import them back, so
 *  the hero, the family panels and the closing CTA cannot drift apart. */
export const docs = {
  releases: `${site.repo}/releases`,
  installGuide: `${site.repo}/blob/main/INSTALL.md`,
  beta: `${site.repo}/blob/main/BETA.md`,
} as const;

// The three inline marks the prose reuses constantly, written once so both
// languages get the identical treatment and the sentences stay readable.

const monoTone = {
  plain: 'font-mono',
  text: 'font-mono text-text',
  accent: 'font-mono text-accent',
} as const;

/** An external link in prose: the same amber-underline treatment everywhere. */
function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  );
}

/** A label quoted from another product's UI ("Dev Mode", "Run anyway"). */
function Ui({ children }: { children: ReactNode }) {
  return <span className="text-text">{children}</span>;
}

/** Inline code; `tone` carries the emphasis the sentence needs. */
function Mono({ tone = 'plain', children }: { tone?: keyof typeof monoTone; children: ReactNode }) {
  return <code className={monoTone[tone]}>{children}</code>;
}

export const download = {
  fr: {
    head: { title: 'Installer' },
    hero: {
      eyebrow: 'Installation',
      h1: (
        <>
          Installez KROMA sur <span className="text-gradient-amber">tous vos écrans</span>.
        </>
      ),
      lede: "Le modèle tient en une phrase : on installe le serveur une seule fois, puis chaque client, TV, ordinateur, mobile, navigateur, pointe vers lui et s'en souvient.",
      server: { label: 'Le serveur', detail: 'Installé une fois, NAS, Docker ou Raspberry Pi.' },
      client: { label: 'Les clients', detail: 'Chaque écran demande son adresse au démarrage.' },
    },
    server: {
      step: {
        title: 'Installez le serveur',
        intro:
          "Un seul serveur Rust : sur un NAS, dans Docker, ou compilé à la main. Il sert l'API, l'app web et le flux vidéo sur le port 4040 en direct-play : la vidéo n'est jamais transcodée.",
      },
      docker: {
        tag: 'Recommandé',
        body: (
          <>
            L'image est <Ui>multi-architecture</Ui> (<Mono tone="accent">linux/amd64</Mono> +{' '}
            <Mono tone="accent">linux/arm64</Mono>) : elle tourne aussi bien sur un x86 que sur un
            Raspberry&nbsp;Pi 4/5 en OS 64 bits. Enregistrez ce fichier puis lancez la pile.
          </>
        ),
        mediaTag: 'Médias',
        mediaBody: (
          <>
            <Mono tone="text">KROMA_MEDIA_DIRS</Mono> pointe vers vos médias <em>dans</em> le
            conteneur ; montez le dossier en lecture-écriture si vous utilisez les requêtes /
            téléchargements intégrés.
          </>
        ),
      },
      synology: {
        title: 'Synology (.spk)',
        body: "Le paquet est auto-signé, pas certifié Synology : il faut l'autoriser une fois.",
        steps: [
          <>
            <Ui>Centre de paquets → Paramètres → Niveau de confiance</Ui> : autorisez{' '}
            <Ui>N'importe quel éditeur</Ui>.
          </>,
          <>
            <Ui>Centre de paquets → Installation manuelle</Ui>, choisissez le{' '}
            <Mono tone="accent">.spk</Mono>, suivez l'assistant.
          </>,
          <>Ouvrez KROMA ; configurez les dossiers médias dans sa console d'administration.</>,
        ],
      },
      cargo: {
        title: 'Depuis les sources (cargo)',
        body: 'Un seul binaire Rust : compilez-le vous-même. SQLite et TLS sont embarqués ; ffmpeg/ffprobe restent requis pour les métadonnées et l’audio HLS.',
        link: 'Options du serveur (server/README) →',
      },
    },
    apps: {
      step: {
        title: 'Installez les apps',
        intro: (
          <>
            Récupérez le bon paquet dans les <Ext href={docs.releases}>GitHub Releases</Ext> (un tag{' '}
            <Mono>vX.Y.Z</Mono> porte tous les artefacts). Un réglage unique par appareil, mode
            développeur ou levée de quarantaine, puis le client demande l'adresse du serveur au
            premier lancement.
          </>
        ),
      },
    },
    families: {
      tv: {
        title: 'Téléviseurs',
        intro:
          "Sideload depuis un ordinateur du même réseau. Le mode développeur s'active une fois.",
        samsung: {
          tag: 'Mode développeur',
          body: (
            <>
              Panneau <Ui>Apps</Ui> → tapez <Mono tone="text">1 2 3 4 5</Mono>, activez-le et
              saisissez l'IP de votre ordinateur. Le <Mono>.wgt</Mono> est déjà signé, aucun
              certificat requis, juste le CLI de Tizen Studio.
            </>
          ),
        },
        lg: {
          tag: 'Mode développeur',
          body: (
            <>
              Installez l'app <Ui>Developer Mode</Ui> (compte LG gratuit), activez <Ui>Dev Mode</Ui>{' '}
              puis <Ui>Key Server</Ui>. La session dure 50&nbsp;h, à prolonger dans l'app.
            </>
          ),
        },
        androidtv: {
          tag: 'Options développeur',
          body: (
            <>
              Paramètres → À propos → <Ui>build Android TV OS</Ui> : cliquez 7&nbsp;fois, puis
              activez le débogage réseau. Sans ordinateur, l'app <Ui>Downloader</Ui> installe l'
              <Mono>.apk</Mono> depuis une URL.
            </>
          ),
        },
        appletv: {
          tag: 'TestFlight',
          body: (
            <>
              Distribuée via TestFlight, sans sideload.{' '}
              <Ext href={docs.beta}>Rejoindre la bêta</Ext>.
            </>
          ),
        },
      },
      computers: {
        title: 'Ordinateurs',
        intro:
          'Des installeurs classiques. Les apps de bureau se mettent à jour toutes seules ensuite.',
        mac: {
          tag: 'Quarantaine',
          body: (
            <>
              Non notarisée : au premier lancement, macOS la dit « endommagée ». Glissez-la dans
              Applications, puis levez la quarantaine une fois (ou Réglages → Confidentialité →{' '}
              <Ui>Ouvrir quand même</Ui>).
            </>
          ),
        },
        win: {
          tag: 'SmartScreen',
          body: (
            <>
              Installeur non signé : « Windows a protégé votre PC » →{' '}
              <Ui>Informations complémentaires</Ui> → <Ui>Exécuter quand même</Ui>. Mises à jour
              silencieuses ensuite.
            </>
          ),
        },
        linuxName: 'Linux (bureau)',
        linux: {
          tag: 'Vidéo',
          body: (
            <>
              mpv est embarqué (le sidecar <Mono>kroma-mpv</Mono> pilote le décodage matériel), rien
              à installer.
            </>
          ),
        },
        steamdeck: [
          <>
            Copiez <Mono tone="text">KROMA_*.AppImage</Mono> sur le Deck et{' '}
            <Mono tone="text">chmod +x</Mono> (Mode Bureau).
          </>,
          <>
            <Ui>Steam → Ajouter un jeu non-Steam → Parcourir</Ui>, puis choisissez l'AppImage.
          </>,
          <>
            Lancez en Mode Jeu, disposition manette sur <Ui>Gamepad</Ui> (croix = focus, A = OK, B =
            retour).
          </>,
        ],
      },
      mobile: {
        title: 'Mobile',
        intro: 'Les apps téléphone sont en cours de finition, distribuées via les canaux de test.',
        ios: {
          tag: 'TestFlight',
          body: (
            <>
              Rejoignez la bêta iOS via TestFlight,{' '}
              <Ext href={docs.beta}>instructions testeurs</Ext>.
            </>
          ),
        },
        android: {
          tag: 'Firebase',
          body: (
            <>
              Distribuée via Firebase App Distribution,{' '}
              <Ext href={docs.beta}>instructions testeurs</Ext>.
            </>
          ),
        },
      },
      nasWeb: {
        title: 'NAS & navigateur',
        intro: "Là où le serveur vit déjà, il n'y a le plus souvent rien de plus à installer.",
        webName: 'Navigateur web',
        web: {
          tag: 'Rien à installer',
          body: (
            <>
              Le serveur sert lui-même l'app web. Ouvrez son adresse dans n'importe quel navigateur,
              ou laissez la découverte mDNS le trouver sur le réseau.
            </>
          ),
        },
        synology: {
          tag: 'Mises à jour automatiques',
          body: (
            <>
              La meilleure voie sur un NAS : ajoutez KROMA comme <Ui>source de paquets</Ui> dans le
              Centre de paquets. Le serveur s'installe puis se met à jour tout seul, sans
              re-télécharger un <Mono>.spk</Mono> à chaque version.
            </>
          ),
        },
        synologySteps: [
          <>
            Centre de paquets → <Ui>Paramètres</Ui> → <Ui>Sources de paquets</Ui> → <Ui>Ajouter</Ui>
            .
          </>,
          <>
            Collez l'URL de la source ci-dessous, puis validez le niveau de confiance{' '}
            <Ui>« N'importe quel éditeur »</Ui> (le paquet est auto-signé).
          </>,
          <>
            Installez <Ui>KROMA</Ui> depuis la source ; les mises à jour arrivent ensuite
            automatiquement.
          </>,
        ],
        sourceLabel: 'source de paquets',
        manual: (
          <>
            Préférez une installation manuelle ? Téléchargez le <Mono>.spk</Mono> depuis{' '}
            <Ext href={docs.releases}>les releases</Ext> et passez par Centre de paquets →
            Installation manuelle.
          </>
        ),
      },
    },
    closing: {
      title: 'Signé pour le développement, pas pour un store.',
      body: "Les builds sont signés avec un certificat de développement, pas de certificat de store payant. C'est toute la raison du réglage unique par appareil (mode développeur, quarantaine, SmartScreen) : une fois fait, les mises à jour passent sans friction. Tout reste auto-hébergé, votre médiathèque et votre activité ne quittent jamais votre réseau.",
      note: "Un paquet qui refuse de s'installer ? Le plus souvent une signature qui a changé : désinstallez l'ancienne version, puis réinstallez.",
      releases: 'Voir les releases',
      guide: 'Guide complet',
      tvDemo: 'Démo TV',
      help: "Besoin d'aide ?",
    },
    // Labels owned by the page's building blocks rather than by one section.
    ui: {
      beta: 'Bêta',
      detailedSteps: 'Étapes détaillées',
      copy: 'Copier',
      copied: 'Copié',
      copyAria: 'Copier la commande',
    },
  },
  en: {
    head: { title: 'Install' },
    hero: {
      eyebrow: 'Installation',
      h1: (
        <>
          Install KROMA on <span className="text-gradient-amber">every screen you own</span>.
        </>
      ),
      lede: 'The model fits in one sentence: install the server once, then every client, TV, computer, phone, browser, points at it and remembers it.',
      server: {
        label: 'The server',
        detail: 'Installed once, on a NAS, in Docker or on a Raspberry Pi.',
      },
      client: { label: 'The clients', detail: 'Every screen asks for its address on startup.' },
    },
    server: {
      step: {
        title: 'Install the server',
        intro:
          'A single Rust server: on a NAS, in Docker, or built by hand. It serves the API, the web app and the video stream on port 4040 in direct-play: video is never transcoded.',
      },
      docker: {
        tag: 'Recommended',
        body: (
          <>
            The image is <Ui>multi-architecture</Ui> (<Mono tone="accent">linux/amd64</Mono> +{' '}
            <Mono tone="accent">linux/arm64</Mono>) : it runs just as well on x86 as on a
            Raspberry&nbsp;Pi 4/5 with a 64-bit OS. Save this file, then bring the stack up.
          </>
        ),
        mediaTag: 'Media',
        mediaBody: (
          <>
            <Mono tone="text">KROMA_MEDIA_DIRS</Mono> points at your media <em>inside</em> the
            container; mount the folder read-write if you use the built-in requests / downloads.
          </>
        ),
      },
      synology: {
        title: 'Synology (.spk)',
        body: 'The package is self-signed, not Synology-certified: you have to allow it once.',
        steps: [
          <>
            <Ui>Package Center → Settings → Trust Level</Ui> : allow <Ui>Any publisher</Ui>.
          </>,
          <>
            <Ui>Package Center → Manual Install</Ui>, pick the <Mono tone="accent">.spk</Mono>,
            follow the wizard.
          </>,
          <>Open KROMA; configure the media folders in its admin console.</>,
        ],
      },
      cargo: {
        title: 'From source (cargo)',
        body: 'A single Rust binary: build it yourself. SQLite and TLS are bundled; ffmpeg/ffprobe are still required for metadata and HLS audio.',
        link: 'Server options (server/README) →',
      },
    },
    apps: {
      step: {
        title: 'Install the apps',
        intro: (
          <>
            Grab the right package from <Ext href={docs.releases}>GitHub Releases</Ext> (one{' '}
            <Mono>vX.Y.Z</Mono> tag carries every artifact). A single setup per device, developer
            mode or lifting quarantine, then the client asks for the server address on first launch.
          </>
        ),
      },
    },
    families: {
      tv: {
        title: 'Televisions',
        intro: 'Sideload from a computer on the same network. Developer mode is enabled once.',
        samsung: {
          tag: 'Developer mode',
          body: (
            <>
              The <Ui>Apps</Ui> panel, type <Mono tone="text">1 2 3 4 5</Mono>, turn it on and enter
              your computer's IP. The <Mono>.wgt</Mono> is already signed, no certificate required,
              just the Tizen Studio CLI.
            </>
          ),
        },
        lg: {
          tag: 'Developer mode',
          body: (
            <>
              Install the <Ui>Developer Mode</Ui> app (free LG account), enable <Ui>Dev Mode</Ui>{' '}
              then <Ui>Key Server</Ui>. The session lasts 50&nbsp;h, extend it from the app.
            </>
          ),
        },
        androidtv: {
          tag: 'Developer options',
          body: (
            <>
              Settings → About → <Ui>Android TV OS build</Ui> : tap 7&nbsp;times, then enable
              network debugging. Without a computer, the <Ui>Downloader</Ui> app installs the{' '}
              <Mono>.apk</Mono> from a URL.
            </>
          ),
        },
        appletv: {
          tag: 'TestFlight',
          body: (
            <>
              Distributed through TestFlight, no sideloading.{' '}
              <Ext href={docs.beta}>Join the beta</Ext>.
            </>
          ),
        },
      },
      computers: {
        title: 'Computers',
        intro: 'Regular installers. The desktop apps update themselves from there on.',
        mac: {
          tag: 'Quarantine',
          body: (
            <>
              Not notarized: on first launch, macOS calls it "damaged". Drag it into Applications,
              then lift the quarantine once (or Settings → Privacy → <Ui>Open anyway</Ui>).
            </>
          ),
        },
        win: {
          tag: 'SmartScreen',
          body: (
            <>
              Unsigned installer: "Windows protected your PC" → <Ui>More info</Ui> →{' '}
              <Ui>Run anyway</Ui>. Silent updates from there on.
            </>
          ),
        },
        linuxName: 'Linux (desktop)',
        linux: {
          tag: 'Video',
          body: (
            <>
              mpv is bundled (the <Mono>kroma-mpv</Mono> sidecar drives hardware decoding), nothing
              to install.
            </>
          ),
        },
        steamdeck: [
          <>
            Copy <Mono tone="text">KROMA_*.AppImage</Mono> onto the Deck and{' '}
            <Mono tone="text">chmod +x</Mono> (Desktop Mode).
          </>,
          <>
            <Ui>Steam → Add a Non-Steam Game → Browse</Ui>, then pick the AppImage.
          </>,
          <>
            Launch in Game Mode, set the controller layout to <Ui>Gamepad</Ui> (D-pad = focus, A =
            OK, B = back).
          </>,
        ],
      },
      mobile: {
        title: 'Mobile',
        intro: 'The phone apps are being finished, distributed through the test channels.',
        ios: {
          tag: 'TestFlight',
          body: (
            <>
              Join the iOS beta through TestFlight, <Ext href={docs.beta}>tester instructions</Ext>.
            </>
          ),
        },
        android: {
          tag: 'Firebase',
          body: (
            <>
              Distributed through Firebase App Distribution,{' '}
              <Ext href={docs.beta}>tester instructions</Ext>.
            </>
          ),
        },
      },
      nasWeb: {
        title: 'NAS & browser',
        intro: 'Where the server already lives, there is usually nothing more to install.',
        webName: 'Web browser',
        web: {
          tag: 'Nothing to install',
          body: (
            <>
              The server serves the web app itself. Open its address in any browser, or let mDNS
              discovery find it on the network.
            </>
          ),
        },
        synology: {
          tag: 'Automatic updates',
          body: (
            <>
              The best route on a NAS: add KROMA as a <Ui>package source</Ui> in Package Center. The
              server installs, then updates itself, without re-downloading a <Mono>.spk</Mono> for
              every release.
            </>
          ),
        },
        synologySteps: [
          <>
            Package Center → <Ui>Settings</Ui> → <Ui>Package Sources</Ui> → <Ui>Add</Ui>.
          </>,
          <>
            Paste the source URL below, then confirm the <Ui>"Any publisher"</Ui> trust level (the
            package is self-signed).
          </>,
          <>
            Install <Ui>KROMA</Ui> from the source; updates then arrive automatically.
          </>,
        ],
        sourceLabel: 'package source',
        manual: (
          <>
            Prefer a manual install? Download the <Mono>.spk</Mono> from{' '}
            <Ext href={docs.releases}>the releases</Ext> and go through Package Center → Manual
            Install.
          </>
        ),
      },
    },
    closing: {
      title: 'Signed for development, not for a store.',
      body: 'The builds are signed with a development certificate, not a paid store certificate. That is the whole reason for the one-time setup per device (developer mode, quarantine, SmartScreen): once done, updates go through without friction. Everything stays self-hosted, your library and your activity never leave your network.',
      note: 'A package that refuses to install? Most often a signature that changed: uninstall the old version, then reinstall.',
      releases: 'See the releases',
      guide: 'Full guide',
      tvDemo: 'TV demo',
      help: 'Need help?',
    },
    ui: {
      beta: 'Beta',
      detailedSteps: 'Detailed steps',
      copy: 'Copy',
      copied: 'Copied',
      copyAria: 'Copy command',
    },
  },
} as const;

/** The install-page strings for the active locale. */
export function useDownload() {
  return download[useLang()];
}
