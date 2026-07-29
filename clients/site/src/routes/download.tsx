import {
  IconAlertTriangle,
  IconArrowRight,
  IconBrandAndroid,
  IconBrandApple,
  IconBrandDebian,
  IconBrandWindows,
  IconDeviceDesktop,
  IconDeviceGamepad2,
  IconDeviceMobile,
  IconDeviceTv,
  IconDeviceTvOld,
  IconInfoCircle,
  IconKey,
  IconRefresh,
  IconServer,
  IconWorld,
} from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '#site/components/button';
import { Container } from '#site/components/container';
import { Callout } from '#site/components/download/callout';
import { CodeBlock } from '#site/components/download/code-block';
import { InstallStep } from '#site/components/download/install-step';
import { PlatformEntry } from '#site/components/download/platform-entry';
import { PlatformFamily } from '#site/components/download/platform-family';
import { ServerOptions } from '#site/components/download/server-options';
import { StepList } from '#site/components/download/step-list';
import { useLang } from '#site/lib/i18n';
import { seo } from '#site/lib/seo';
import { site } from '#site/lib/site';

// The three off-site destinations this page sends people to. Centralised so the
// hero, the family panels and the closing CTA can't drift apart.
const RELEASES = `${site.repo}/releases`;
const INSTALL_GUIDE = `${site.repo}/blob/main/INSTALL.md`;
const BETA_GUIDE = `${site.repo}/blob/main/BETA.md`;

// Shared class for the inline external links in prose, so both languages point
// through the exact same amber-underline treatment.
const linkCls =
  'text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent';

// Page copy in both languages. Prose, labels, callout bodies and headings are
// translated; the shell commands, URLs, artifact extensions and device names
// (Samsung, LG, macOS…) are language-neutral and stay hardcoded at the call
// site. React fragments are safe at module scope: they carry no per-render state,
// so building them once is correct. The `fr`/`en` shapes are structurally checked
// against each other by every `copy[useLang()]` access.
const copy = {
  fr: {
    header: {
      eyebrow: 'Installation',
      h1: (
        <>
          Installez KROMA sur <span className="text-gradient-amber">tous vos écrans</span>.
        </>
      ),
      lede: "Le modèle tient en une phrase : on installe le serveur une seule fois, puis chaque client, TV, ordinateur, mobile, navigateur, pointe vers lui et s'en souvient.",
      server: { label: 'Le serveur', detail: 'Installé une fois, NAS, Docker ou Raspberry Pi.' },
      client: {
        label: 'Les clients',
        detail: 'Chaque écran demande son adresse au démarrage.',
      },
    },
    step1: {
      title: 'Installez le serveur',
      intro:
        "Un seul serveur Rust : sur un NAS, dans Docker, ou compilé à la main. Il sert l'API, l'app web et le flux vidéo sur le port 4040 en direct-play : la vidéo n'est jamais transcodée.",
    },
    step2: {
      title: 'Installez les apps',
      intro: (
        <>
          Récupérez le bon paquet dans les{' '}
          <a href={RELEASES} target="_blank" rel="noreferrer noopener" className={linkCls}>
            GitHub Releases
          </a>{' '}
          (un tag <code className="font-mono">vX.Y.Z</code> porte tous les artefacts). Un réglage
          unique par appareil, mode développeur ou levée de quarantaine, puis le client demande
          l'adresse du serveur au premier lancement.
        </>
      ),
    },
    tv: {
      title: 'Téléviseurs',
      intro: "Sideload depuis un ordinateur du même réseau. Le mode développeur s'active une fois.",
      samsung: {
        tag: 'Mode développeur',
        body: (
          <>
            Panneau <span className="text-text">Apps</span> → tapez{' '}
            <code className="font-mono text-text">1 2 3 4 5</code>, activez-le et saisissez l'IP de
            votre ordinateur. Le <code className="font-mono">.wgt</code> est déjà signé, aucun
            certificat requis, juste le CLI de Tizen Studio.
          </>
        ),
      },
      lg: {
        tag: 'Mode développeur',
        body: (
          <>
            Installez l'app <span className="text-text">Developer Mode</span> (compte LG gratuit),
            activez <span className="text-text">Dev Mode</span> puis{' '}
            <span className="text-text">Key Server</span>. La session dure 50&nbsp;h, à prolonger
            dans l'app.
          </>
        ),
      },
      androidtv: {
        tag: 'Options développeur',
        body: (
          <>
            Paramètres → À propos → <span className="text-text">build Android TV OS</span> : cliquez
            7&nbsp;fois, puis activez le débogage réseau. Sans ordinateur, l'app{' '}
            <span className="text-text">Downloader</span> installe l'
            <code className="font-mono">.apk</code> depuis une URL.
          </>
        ),
      },
      appletv: {
        tag: 'TestFlight',
        body: (
          <>
            Distribuée via TestFlight, sans sideload.{' '}
            <a href={BETA_GUIDE} target="_blank" rel="noreferrer noopener" className={linkCls}>
              Rejoindre la bêta
            </a>
            .
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
            <span className="text-text">Ouvrir quand même</span>).
          </>
        ),
      },
      win: {
        tag: 'SmartScreen',
        body: (
          <>
            Installeur non signé : « Windows a protégé votre PC » →{' '}
            <span className="text-text">Informations complémentaires</span> →{' '}
            <span className="text-text">Exécuter quand même</span>. Mises à jour silencieuses
            ensuite.
          </>
        ),
      },
      linuxName: 'Linux (bureau)',
      linux: {
        tag: 'Vidéo',
        body: (
          <>
            mpv est embarqué (le sidecar <code className="font-mono">kroma-mpv</code> pilote le
            décodage matériel), rien à installer.
          </>
        ),
      },
      steamdeck: [
        <>
          Copiez <code className="font-mono text-text">KROMA_*.AppImage</code> sur le Deck et{' '}
          <code className="font-mono text-text">chmod +x</code> (Mode Bureau).
        </>,
        <>
          <span className="text-text">Steam → Ajouter un jeu non-Steam → Parcourir</span>, puis
          choisissez l'AppImage.
        </>,
        <>
          Lancez en Mode Jeu, disposition manette sur <span className="text-text">Gamepad</span>{' '}
          (croix = focus, A = OK, B = retour).
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
            <a href={BETA_GUIDE} target="_blank" rel="noreferrer noopener" className={linkCls}>
              instructions testeurs
            </a>
            .
          </>
        ),
      },
      android: {
        tag: 'Firebase',
        body: (
          <>
            Distribuée via Firebase App Distribution,{' '}
            <a href={BETA_GUIDE} target="_blank" rel="noreferrer noopener" className={linkCls}>
              instructions testeurs
            </a>
            .
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
            La meilleure voie sur un NAS : ajoutez KROMA comme{' '}
            <span className="text-text">source de paquets</span> dans le Centre de paquets. Le
            serveur s'installe puis se met à jour tout seul, sans re-télécharger un{' '}
            <code className="font-mono">.spk</code> à chaque version.
          </>
        ),
      },
      synologySteps: [
        <>
          Centre de paquets → <span className="text-text">Paramètres</span> →{' '}
          <span className="text-text">Sources de paquets</span> →{' '}
          <span className="text-text">Ajouter</span>.
        </>,
        <>
          Collez l'URL de la source ci-dessous, puis validez le niveau de confiance{' '}
          <span className="text-text">« N'importe quel éditeur »</span> (le paquet est auto-signé).
        </>,
        <>
          Installez <span className="text-text">KROMA</span> depuis la source ; les mises à jour
          arrivent ensuite automatiquement.
        </>,
      ],
      sourceLabel: 'source de paquets',
      manual: (
        <>
          Préférez une installation manuelle ? Téléchargez le{' '}
          <code className="font-mono">.spk</code> depuis{' '}
          <a href={RELEASES} target="_blank" rel="noreferrer noopener" className={linkCls}>
            les releases
          </a>{' '}
          et passez par Centre de paquets → Installation manuelle.
        </>
      ),
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
  },
  en: {
    header: {
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
      client: {
        label: 'The clients',
        detail: 'Every screen asks for its address on startup.',
      },
    },
    step1: {
      title: 'Install the server',
      intro:
        'A single Rust server: on a NAS, in Docker, or built by hand. It serves the API, the web app and the video stream on port 4040 in direct-play: video is never transcoded.',
    },
    step2: {
      title: 'Install the apps',
      intro: (
        <>
          Grab the right package from{' '}
          <a href={RELEASES} target="_blank" rel="noreferrer noopener" className={linkCls}>
            GitHub Releases
          </a>{' '}
          (one <code className="font-mono">vX.Y.Z</code> tag carries every artifact). A single setup
          per device, developer mode or lifting quarantine, then the client asks for the server
          address on first launch.
        </>
      ),
    },
    tv: {
      title: 'Televisions',
      intro: 'Sideload from a computer on the same network. Developer mode is enabled once.',
      samsung: {
        tag: 'Developer mode',
        body: (
          <>
            The <span className="text-text">Apps</span> panel, type{' '}
            <code className="font-mono text-text">1 2 3 4 5</code>, turn it on and enter your
            computer's IP. The <code className="font-mono">.wgt</code> is already signed, no
            certificate required, just the Tizen Studio CLI.
          </>
        ),
      },
      lg: {
        tag: 'Developer mode',
        body: (
          <>
            Install the <span className="text-text">Developer Mode</span> app (free LG account),
            enable <span className="text-text">Dev Mode</span> then{' '}
            <span className="text-text">Key Server</span>. The session lasts 50&nbsp;h, extend it
            from the app.
          </>
        ),
      },
      androidtv: {
        tag: 'Developer options',
        body: (
          <>
            Settings → About → <span className="text-text">Android TV OS build</span> : tap
            7&nbsp;times, then enable network debugging. Without a computer, the{' '}
            <span className="text-text">Downloader</span> app installs the{' '}
            <code className="font-mono">.apk</code> from a URL.
          </>
        ),
      },
      appletv: {
        tag: 'TestFlight',
        body: (
          <>
            Distributed through TestFlight, no sideloading.{' '}
            <a href={BETA_GUIDE} target="_blank" rel="noreferrer noopener" className={linkCls}>
              Join the beta
            </a>
            .
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
            then lift the quarantine once (or Settings → Privacy →{' '}
            <span className="text-text">Open anyway</span>).
          </>
        ),
      },
      win: {
        tag: 'SmartScreen',
        body: (
          <>
            Unsigned installer: "Windows protected your PC" →{' '}
            <span className="text-text">More info</span> →{' '}
            <span className="text-text">Run anyway</span>. Silent updates from there on.
          </>
        ),
      },
      linuxName: 'Linux (desktop)',
      linux: {
        tag: 'Video',
        body: (
          <>
            mpv is bundled (the <code className="font-mono">kroma-mpv</code> sidecar drives hardware
            decoding), nothing to install.
          </>
        ),
      },
      steamdeck: [
        <>
          Copy <code className="font-mono text-text">KROMA_*.AppImage</code> onto the Deck and{' '}
          <code className="font-mono text-text">chmod +x</code> (Desktop Mode).
        </>,
        <>
          <span className="text-text">Steam → Add a Non-Steam Game → Browse</span>, then pick the
          AppImage.
        </>,
        <>
          Launch in Game Mode, set the controller layout to{' '}
          <span className="text-text">Gamepad</span> (D-pad = focus, A = OK, B = back).
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
            Join the iOS beta through TestFlight,{' '}
            <a href={BETA_GUIDE} target="_blank" rel="noreferrer noopener" className={linkCls}>
              tester instructions
            </a>
            .
          </>
        ),
      },
      android: {
        tag: 'Firebase',
        body: (
          <>
            Distributed through Firebase App Distribution,{' '}
            <a href={BETA_GUIDE} target="_blank" rel="noreferrer noopener" className={linkCls}>
              tester instructions
            </a>
            .
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
            The best route on a NAS: add KROMA as a{' '}
            <span className="text-text">package source</span> in Package Center. The server
            installs, then updates itself, without re-downloading a{' '}
            <code className="font-mono">.spk</code> for every release.
          </>
        ),
      },
      synologySteps: [
        <>
          Package Center → <span className="text-text">Settings</span> →{' '}
          <span className="text-text">Package Sources</span> →{' '}
          <span className="text-text">Add</span>.
        </>,
        <>
          Paste the source URL below, then confirm the{' '}
          <span className="text-text">"Any publisher"</span> trust level (the package is
          self-signed).
        </>,
        <>
          Install <span className="text-text">KROMA</span> from the source; updates then arrive
          automatically.
        </>,
      ],
      sourceLabel: 'package source',
      manual: (
        <>
          Prefer a manual install? Download the <code className="font-mono">.spk</code> from{' '}
          <a href={RELEASES} target="_blank" rel="noreferrer noopener" className={linkCls}>
            the releases
          </a>{' '}
          and go through Package Center → Manual Install.
        </>
      ),
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
  },
} as const;

export const Route = createFileRoute('/download')({
  head: () => ({ ...seo({ lang: 'en', title: 'Install', path: '/download' }) }),
  component: Download,
});

export function Download() {
  const t = copy[useLang()];
  return (
    <>
      <Header />

      <InstallStep id="serveur" step="01" title={t.step1.title} intro={t.step1.intro}>
        <ServerOptions />
      </InstallStep>

      <InstallStep id="apps" step="02" title={t.step2.title} intro={t.step2.intro}>
        <div className="space-y-14">
          <Televisions />
          <Computers />
          <Mobile />
          <NasAndWeb />
        </div>
      </InstallStep>

      <Closing />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Header, the model in one line, plus a two-node "server → clients" strip.  */
/* -------------------------------------------------------------------------- */

function Header() {
  const t = copy[useLang()].header;
  return (
    <section className="relative overflow-hidden">
      <div className="glow-amber pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
      <Container>
        <div className="relative max-w-3xl py-20 sm:py-24">
          <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
            {t.eyebrow}
          </p>
          <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.03] text-text sm:text-5xl">
            {t.h1}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted">{t.lede}</p>

          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <ModelNode icon={IconServer} label={t.server.label} detail={t.server.detail} />
            <IconArrowRight
              size={22}
              stroke={1.75}
              className="mx-auto shrink-0 rotate-90 text-dim sm:rotate-0"
              aria-hidden
            />
            <ModelNode icon={IconDeviceTv} label={t.client.label} detail={t.client.detail} />
          </div>
        </div>
      </Container>
    </section>
  );
}

function ModelNode({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof IconServer;
  label: string;
  detail: string;
}) {
  return (
    <div className="surface-hairline flex flex-1 items-start gap-3 rounded-xl border border-border bg-surface-1/50 p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-accent">
        <Icon size={18} stroke={1.75} aria-hidden />
      </div>
      <div>
        <p className="font-display text-sm font-bold text-text">{label}</p>
        <p className="mt-0.5 text-sm leading-snug text-muted">{detail}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 2 families, authored by hand (not a data loop) so each device gets   */
/*  the note and command that actually matters for it.                         */
/* -------------------------------------------------------------------------- */

function Televisions() {
  const t = copy[useLang()].tv;
  return (
    <PlatformFamily icon={IconDeviceTv} title={t.title} intro={t.intro} docHref={INSTALL_GUIDE}>
      <PlatformEntry
        icon={IconDeviceTv}
        name="Samsung (Tizen)"
        artifacts={['.wgt']}
        setup={
          <Callout icon={IconKey} tag={t.samsung.tag}>
            {t.samsung.body}
          </Callout>
        }
      >
        <CodeBlock
          label="bash"
          code={`sdb connect 192.168.1.50
tizen install -n KROMA.wgt -t <device-id>`}
        />
      </PlatformEntry>

      <PlatformEntry
        icon={IconDeviceTvOld}
        name="LG (webOS 4.0+)"
        artifacts={['.ipk']}
        setup={
          <Callout icon={IconKey} tag={t.lg.tag}>
            {t.lg.body}
          </Callout>
        }
      >
        <CodeBlock
          label="bash"
          code={`bun add -g @webos-tools/cli
ares-install tv.kroma.webos_*_all.ipk -d tv`}
        />
      </PlatformEntry>

      <PlatformEntry
        icon={IconBrandAndroid}
        name="Android TV / Google TV / Chromecast"
        artifacts={['.apk']}
        setup={
          <Callout icon={IconKey} tag={t.androidtv.tag}>
            {t.androidtv.body}
          </Callout>
        }
      >
        <CodeBlock
          label="bash"
          code={`adb connect 192.168.1.60:5555
adb install -r KROMA-androidtv.apk`}
        />
      </PlatformEntry>

      <PlatformEntry
        icon={IconBrandApple}
        name="Apple TV"
        beta
        setup={
          <Callout icon={IconInfoCircle} tag={t.appletv.tag}>
            {t.appletv.body}
          </Callout>
        }
      />
    </PlatformFamily>
  );
}

function Computers() {
  const t = copy[useLang()].computers;
  return (
    <PlatformFamily
      icon={IconDeviceDesktop}
      title={t.title}
      intro={t.intro}
      docHref={INSTALL_GUIDE}
    >
      <PlatformEntry
        icon={IconBrandApple}
        name="macOS"
        artifacts={['.dmg']}
        setup={
          <Callout icon={IconAlertTriangle} tag={t.mac.tag}>
            {t.mac.body}
          </Callout>
        }
      >
        <CodeBlock label="bash" code="xattr -dr com.apple.quarantine /Applications/KROMA.app" />
      </PlatformEntry>

      <PlatformEntry
        icon={IconBrandWindows}
        name="Windows"
        artifacts={['.exe', '.msi']}
        setup={
          <Callout icon={IconAlertTriangle} tag={t.win.tag}>
            {t.win.body}
          </Callout>
        }
      />

      <PlatformEntry
        icon={IconBrandDebian}
        name={t.linuxName}
        artifacts={['.AppImage', '.deb']}
        setup={
          <Callout icon={IconInfoCircle} tag={t.linux.tag}>
            {t.linux.body}
          </Callout>
        }
      >
        <CodeBlock
          label="bash"
          code={`chmod +x KROMA_*.AppImage && ./KROMA_*.AppImage
# .deb : sudo apt install ./KROMA_*.deb`}
        />
      </PlatformEntry>

      <PlatformEntry icon={IconDeviceGamepad2} name="Steam Deck" artifacts={['.AppImage']}>
        <StepList steps={[...t.steamdeck]} />
      </PlatformEntry>
    </PlatformFamily>
  );
}

function Mobile() {
  const t = copy[useLang()].mobile;
  return (
    <PlatformFamily icon={IconDeviceMobile} title={t.title} intro={t.intro} docHref={BETA_GUIDE}>
      <PlatformEntry
        icon={IconBrandApple}
        name="iPhone / iPad"
        beta
        setup={
          <Callout icon={IconInfoCircle} tag={t.ios.tag}>
            {t.ios.body}
          </Callout>
        }
      />
      <PlatformEntry
        icon={IconBrandAndroid}
        name="Android"
        beta
        setup={
          <Callout icon={IconInfoCircle} tag={t.android.tag}>
            {t.android.body}
          </Callout>
        }
      />
    </PlatformFamily>
  );
}

function NasAndWeb() {
  const t = copy[useLang()].nasWeb;
  return (
    <PlatformFamily icon={IconServer} title={t.title} intro={t.intro} docHref={INSTALL_GUIDE}>
      <PlatformEntry
        icon={IconWorld}
        name={t.webName}
        setup={
          <Callout icon={IconInfoCircle} tag={t.web.tag}>
            {t.web.body}
          </Callout>
        }
      >
        <CodeBlock label="url" code="http://nas.local:4040" />
      </PlatformEntry>

      <PlatformEntry
        icon={IconServer}
        name="Synology"
        artifacts={['.spk']}
        setup={
          <Callout icon={IconRefresh} tag={t.synology.tag}>
            {t.synology.body}
          </Callout>
        }
      >
        <StepList steps={[...t.synologySteps]} />
        <div className="mt-4">
          <CodeBlock label={t.sourceLabel} code={site.packagesUrl} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-dim">{t.manual}</p>
      </PlatformEntry>
    </PlatformFamily>
  );
}

/* -------------------------------------------------------------------------- */
/*  Closing, why the one-time setup exists, and where to go next.             */
/* -------------------------------------------------------------------------- */

function Closing() {
  const t = copy[useLang()].closing;
  return (
    <section className="border-t border-border/60 py-20">
      <Container>
        <div className="surface-hairline rounded-2xl border border-border bg-surface-1/40 p-8 sm:p-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-extrabold text-text">{t.title}</h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted">{t.body}</p>
            <p className="mt-4 text-sm leading-relaxed text-dim">{t.note}</p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href={RELEASES} size="lg">
              {t.releases}
            </Button>
            <Button href={INSTALL_GUIDE} variant="outline" size="lg">
              {t.guide}
            </Button>
            <Button href={site.tvUrl} variant="outline" size="lg">
              {t.tvDemo}
            </Button>
            <Button to="/support" variant="ghost" size="lg">
              {t.help}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
