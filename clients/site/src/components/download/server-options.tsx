import { IconBrandDocker, IconBrandRust, IconInfoCircle, IconServer } from '@tabler/icons-react';
import type { ComponentType, ReactNode } from 'react';
import { Callout } from '#site/components/download/callout';
import { CodeBlock } from '#site/components/download/code-block';
import { StepList } from '#site/components/download/step-list';
import { site } from '#site/lib/site';

type IconComponent = ComponentType<{ size?: number | string; stroke?: number; className?: string }>;

/** The published multi-arch image. Kept in step with the repo's docker-compose.yml. */
const IMAGE = 'ghcr.io/maxscharwath/kroma:latest';

// A trimmed but runnable copy of the repo's compose file, the same image, port,
// volume layout and KROMA_MEDIA_DIRS, without the optional HTTPS block so the
// snippet stays scannable. The full commented version ships in the repo.
const COMPOSE = `services:
  kroma:
    image: ${IMAGE}
    restart: unless-stopped
    ports:
      - "4040:4040"
    environment:
      # Library roots INSIDE the container (must match the bind-mount below).
      KROMA_MEDIA_DIRS: /media
    volumes:
      - kroma-data:/data
      - /volume1/video:/media
volumes:
  kroma-data:`;

const CARGO = `# Rust ≥ 1.86 + ffprobe. From the repo:
cd server
KROMA_MEDIA_DIRS=/mnt/media cargo run --release`;

/** Shared chrome for one server option: an icon tile, a title, an optional tag. */
function OptionHead({
  icon: Icon,
  title,
  tag,
}: {
  icon: IconComponent;
  title: string;
  tag?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-accent">
        <Icon size={20} stroke={1.75} />
      </div>
      <h3 className="font-display text-lg font-bold text-text">{title}</h3>
      {tag && (
        <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-accent">
          {tag}
        </span>
      )}
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={[
        'surface-hairline rounded-2xl border border-border bg-surface-1/40 p-6 sm:p-7',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

/**
 * Step 1's body: the three real ways to stand the server up. Docker leads
 * (featured, full width, with the actual compose file); Synology and cargo sit
 * beneath as a pair, an editorial hierarchy rather than three equal cards.
 */
export function ServerOptions() {
  return (
    <div className="space-y-5">
      <Panel>
        <OptionHead icon={IconBrandDocker} title="Docker / Docker Compose" tag="Recommandé" />
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          L'image est <span className="text-text">multi-architecture</span> (
          <code className="font-mono text-accent">linux/amd64</code> +{' '}
          <code className="font-mono text-accent">linux/arm64</code>) : elle tourne aussi bien sur
          un x86 que sur un Raspberry&nbsp;Pi 4/5 en OS 64 bits. Enregistrez ce fichier puis lancez
          la pile.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <CodeBlock label="docker-compose.yml" code={COMPOSE} />
          <div className="flex flex-col gap-4">
            <CodeBlock label="bash" code="docker compose up -d" />
            <Callout icon={IconInfoCircle} tag="Médias">
              <code className="font-mono text-text">KROMA_MEDIA_DIRS</code> pointe vers vos médias{' '}
              <em>dans</em> le conteneur ; montez le dossier en lecture-écriture si vous utilisez
              les requêtes / téléchargements intégrés.
            </Callout>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <OptionHead icon={IconServer} title="Synology (.spk)" />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Le paquet est auto-signé, pas certifié Synology : il faut l'autoriser une fois.
          </p>
          <div className="mt-5">
            <StepList
              steps={[
                <>
                  <span className="text-text">
                    Centre de paquets → Paramètres → Niveau de confiance
                  </span>{' '}
                  : autorisez <span className="text-text">N'importe quel éditeur</span>.
                </>,
                <>
                  <span className="text-text">Centre de paquets → Installation manuelle</span>,
                  choisissez le <code className="font-mono text-accent">.spk</code>, suivez
                  l'assistant.
                </>,
                <>
                  Ouvrez KROMA ; configurez les dossiers médias dans sa console d'administration.
                </>,
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <OptionHead icon={IconBrandRust} title="Depuis les sources (cargo)" />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Un seul binaire Rust : compilez-le vous-même. SQLite et TLS sont embarqués ;
            ffmpeg/ffprobe restent requis pour les métadonnées et l’audio HLS.
          </p>
          <div className="mt-5">
            <CodeBlock label="bash" code={CARGO} />
          </div>
          <a
            href={`${site.repo}/blob/main/server/README.md`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-opacity hover:opacity-80"
          >
            Options du serveur (server/README) →
          </a>
        </Panel>
      </div>
    </div>
  );
}
