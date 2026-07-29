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
import { seo } from '#site/lib/seo';
import { site } from '#site/lib/site';

// The three off-site destinations this page sends people to. Centralised so the
// hero, the family panels and the closing CTA can't drift apart.
const RELEASES = `${site.repo}/releases`;
const INSTALL_GUIDE = `${site.repo}/blob/main/INSTALL.md`;
const BETA_GUIDE = `${site.repo}/blob/main/BETA.md`;

export const Route = createFileRoute('/download')({
  head: () => ({ ...seo({ title: 'Installer', path: '/download' }) }),
  component: Download,
});

function Download() {
  return (
    <>
      <Header />

      <InstallStep
        id="serveur"
        step="01"
        title="Installez le serveur"
        intro="Un seul binaire Rust : sur un NAS, dans Docker, ou compilé à la main. Il sert l'API, l'app web et le flux vidéo sur le port 4040 — direct-play, jamais de transcodage."
      >
        <ServerOptions />
      </InstallStep>

      <InstallStep
        id="apps"
        step="02"
        title="Installez les apps"
        intro={
          <>
            Récupérez le bon paquet dans les{' '}
            <a
              href={RELEASES}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              GitHub Releases
            </a>{' '}
            (un tag <code className="font-mono">vX.Y.Z</code> porte tous les artefacts). Un réglage
            unique par appareil — mode développeur ou levée de quarantaine — puis le client demande
            l'adresse du serveur au premier lancement.
          </>
        }
      >
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
/*  Header — the model in one line, plus a two-node "server → clients" strip.  */
/* -------------------------------------------------------------------------- */

function Header() {
  return (
    <section className="relative overflow-hidden">
      <div className="glow-amber pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
      <Container>
        <div className="relative max-w-3xl py-20 sm:py-24">
          <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Installation
          </p>
          <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.03] text-text sm:text-5xl">
            Installez KROMA sur <span className="text-gradient-amber">tous vos écrans</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted">
            Le modèle tient en une phrase : on installe le serveur une seule fois, puis chaque
            client — TV, ordinateur, mobile, navigateur — pointe vers lui et s'en souvient.
          </p>

          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <ModelNode
              icon={IconServer}
              label="Le serveur"
              detail="Installé une fois — NAS, Docker ou Raspberry Pi."
            />
            <IconArrowRight
              size={22}
              stroke={1.75}
              className="mx-auto shrink-0 rotate-90 text-dim sm:rotate-0"
              aria-hidden
            />
            <ModelNode
              icon={IconDeviceTv}
              label="Les clients"
              detail="Chaque écran demande son adresse au démarrage."
            />
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
        <Icon size={18} stroke={1.75} />
      </div>
      <div>
        <p className="font-display text-sm font-bold text-text">{label}</p>
        <p className="mt-0.5 text-sm leading-snug text-muted">{detail}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 2 families — authored by hand (not a data loop) so each device gets   */
/*  the note and command that actually matters for it.                         */
/* -------------------------------------------------------------------------- */

function Televisions() {
  return (
    <PlatformFamily
      icon={IconDeviceTv}
      title="Téléviseurs"
      intro="Sideload depuis un ordinateur du même réseau. Le mode développeur s'active une fois."
      docHref={INSTALL_GUIDE}
    >
      <PlatformEntry
        icon={IconDeviceTv}
        name="Samsung (Tizen)"
        artifacts={['.wgt']}
        setup={
          <Callout icon={IconKey} tag="Mode développeur">
            Panneau <span className="text-text">Apps</span> → tapez{' '}
            <code className="font-mono text-text">1 2 3 4 5</code>, activez-le et saisissez l'IP de
            votre ordinateur. Le <code className="font-mono">.wgt</code> est déjà signé — aucun
            certificat requis, juste le CLI de Tizen Studio.
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
          <Callout icon={IconKey} tag="Mode développeur">
            Installez l'app <span className="text-text">Developer Mode</span> (compte LG gratuit),
            activez <span className="text-text">Dev Mode</span> puis{' '}
            <span className="text-text">Key Server</span>. La session dure 50&nbsp;h, à prolonger
            dans l'app.
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
          <Callout icon={IconKey} tag="Options développeur">
            Paramètres → À propos → <span className="text-text">build Android TV OS</span> : cliquez
            7&nbsp;fois, puis activez le débogage réseau. Sans ordinateur, l'app{' '}
            <span className="text-text">Downloader</span> installe l'
            <code className="font-mono">.apk</code> depuis une URL.
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
          <Callout icon={IconInfoCircle} tag="TestFlight">
            Distribuée via TestFlight, sans sideload.{' '}
            <a
              href={BETA_GUIDE}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              Rejoindre la bêta
            </a>
            .
          </Callout>
        }
      />
    </PlatformFamily>
  );
}

function Computers() {
  return (
    <PlatformFamily
      icon={IconDeviceDesktop}
      title="Ordinateurs"
      intro="Des installeurs classiques. Les apps de bureau se mettent à jour toutes seules ensuite."
      docHref={INSTALL_GUIDE}
    >
      <PlatformEntry
        icon={IconBrandApple}
        name="macOS"
        artifacts={['.dmg']}
        setup={
          <Callout icon={IconAlertTriangle} tag="Quarantaine">
            Non notarisée : au premier lancement, macOS la dit « endommagée ». Glissez-la dans
            Applications, puis levez la quarantaine une fois (ou Réglages → Confidentialité →{' '}
            <span className="text-text">Ouvrir quand même</span>).
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
          <Callout icon={IconAlertTriangle} tag="SmartScreen">
            Installeur non signé : « Windows a protégé votre PC » →{' '}
            <span className="text-text">Informations complémentaires</span> →{' '}
            <span className="text-text">Exécuter quand même</span>. Mises à jour silencieuses
            ensuite.
          </Callout>
        }
      />

      <PlatformEntry
        icon={IconBrandDebian}
        name="Linux (bureau)"
        artifacts={['.AppImage', '.deb']}
        setup={
          <Callout icon={IconInfoCircle} tag="Vidéo">
            mpv est embarqué (le sidecar <code className="font-mono">kroma-mpv</code> pilote le
            décodage matériel) — rien à installer.
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
        <StepList
          steps={[
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
          ]}
        />
      </PlatformEntry>
    </PlatformFamily>
  );
}

function Mobile() {
  return (
    <PlatformFamily
      icon={IconDeviceMobile}
      title="Mobile"
      intro="Les apps téléphone sont en cours de finition, distribuées via les canaux de test."
      docHref={BETA_GUIDE}
    >
      <PlatformEntry
        icon={IconBrandApple}
        name="iPhone / iPad"
        beta
        setup={
          <Callout icon={IconInfoCircle} tag="TestFlight">
            Rejoignez la bêta iOS via TestFlight —{' '}
            <a
              href={BETA_GUIDE}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              instructions testeurs
            </a>
            .
          </Callout>
        }
      />
      <PlatformEntry
        icon={IconBrandAndroid}
        name="Android"
        beta
        setup={
          <Callout icon={IconInfoCircle} tag="Firebase">
            Distribuée via Firebase App Distribution —{' '}
            <a
              href={BETA_GUIDE}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              instructions testeurs
            </a>
            .
          </Callout>
        }
      />
    </PlatformFamily>
  );
}

function NasAndWeb() {
  return (
    <PlatformFamily
      icon={IconServer}
      title="NAS & navigateur"
      intro="Là où le serveur vit déjà, il n'y a le plus souvent rien de plus à installer."
      docHref={INSTALL_GUIDE}
    >
      <PlatformEntry
        icon={IconWorld}
        name="Navigateur web"
        setup={
          <Callout icon={IconInfoCircle} tag="Rien à installer">
            Le serveur sert lui-même l'app web. Ouvrez son adresse dans n'importe quel navigateur —
            ou laissez la découverte mDNS le trouver sur le réseau.
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
          <Callout icon={IconInfoCircle} tag="C'est le serveur">
            Sur un NAS, le <code className="font-mono">.spk</code> installe le serveur lui-même —
            voir <span className="text-text">l'Étape 1</span>. Il sert ensuite l'app web à tous les
            appareils du foyer.
          </Callout>
        }
      />
    </PlatformFamily>
  );
}

/* -------------------------------------------------------------------------- */
/*  Closing — why the one-time setup exists, and where to go next.             */
/* -------------------------------------------------------------------------- */

function Closing() {
  return (
    <section className="border-t border-border/60 py-20">
      <Container>
        <div className="surface-hairline rounded-2xl border border-border bg-surface-1/40 p-8 sm:p-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-extrabold text-text">
              Signé pour le développement, pas pour un store.
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted">
              Les builds sont signés avec un certificat de développement — pas de certificat de
              store payant. C'est toute la raison du réglage unique par appareil (mode développeur,
              quarantaine, SmartScreen) : une fois fait, les mises à jour passent sans friction.
              Tout reste auto-hébergé — votre médiathèque et votre activité ne quittent jamais votre
              réseau.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-dim">
              Un paquet qui refuse de s'installer ? Le plus souvent une signature qui a changé :
              désinstallez l'ancienne version, puis réinstallez.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href={RELEASES} size="lg">
              Voir les releases
            </Button>
            <Button href={INSTALL_GUIDE} variant="outline" size="lg">
              Guide complet
            </Button>
            <Button href={site.tvUrl} variant="outline" size="lg">
              Démo TV
            </Button>
            <Button to="/support" variant="ghost" size="lg">
              Besoin d'aide ?
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
