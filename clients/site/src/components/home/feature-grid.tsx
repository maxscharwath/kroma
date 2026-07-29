import {
  IconChartLine,
  IconDownload,
  IconPlayerPlay,
  IconShieldHalf,
  IconSparkles,
  IconTargetArrow,
  IconUsers,
  IconWorldSearch,
} from '@tabler/icons-react';
import { Section } from '#site/components/section';

// Capabilities as a spec sheet, not eight identical gradient cards. The cells
// share hairlines (a `gap-px` grid over a `bg-border` sheet) so the block reads
// as one instrument panel; two cells span wider than the rest so the eye lands on
// the acquisition brain and the VPN first. Every card carries a precise mono
// footer — the real name of the thing — because that is what a developer trusts.
const FEATURES = [
  {
    Icon: IconTargetArrow,
    title: 'Acquisition automatique',
    body: 'Demandez un titre : KROMA cherche chez tous vos indexeurs, note chaque release sur la résolution, le codec, la taille, les seeders et vos mots-clés, récupère la meilleure, puis l’importe et la renomme façon Plex.',
    tag: 'moteur de décision · wanted-list',
    span: 'lg:col-span-3 sm:col-span-2',
  },
  {
    Icon: IconShieldHalf,
    title: 'VPN avec vrai kill-switch',
    body: 'Collez une config WireGuard et tout le trafic torrent passe par un pont WireGuard→SOCKS5 managé. Un test de tunnel qui échoue met chaque téléchargement en pause à l’instant — pas de fuite, pas de sidecar.',
    tag: 'WireGuard → SOCKS5',
    span: 'lg:col-span-3 sm:col-span-2',
  },
  {
    Icon: IconWorldSearch,
    title: 'Indexeurs natifs',
    body: 'Un moteur Cardigann réimplémenté exécute les définitions de trackers de Jackett et Prowlarr, directement.',
    tag: 'Cardigann + Torznab',
    span: 'lg:col-span-2',
  },
  {
    Icon: IconDownload,
    title: 'Moteur de téléchargement',
    body: 'Un client BitTorrent embarqué récupère les releases dans le même process. Transmission et qBittorrent restent supportés.',
    tag: 'librqbit · in-process',
    span: 'lg:col-span-2',
  },
  {
    Icon: IconPlayerPlay,
    title: 'Lecteur direct-play',
    body: 'Les fichiers originaux sont diffusés par plages d’octets et décodés par le client. La vidéo n’est jamais ré-encodée.',
    tag: 'HEVC/H.265 · range-streamed',
    span: 'lg:col-span-2',
  },
  {
    Icon: IconSparkles,
    title: 'IA embarquée',
    body: 'Recommandations et recherche sémantique sur des embeddings locaux, sous-titres générés par Whisper. Sur votre machine, sans cloud.',
    tag: 'on-device · Whisper',
    span: 'lg:col-span-2',
  },
  {
    Icon: IconUsers,
    title: 'Multi-utilisateur',
    body: 'Comptes, profils, verrous PIN, passkeys WebAuthn, invitations et permissions par utilisateur. Partagez sans tout ouvrir.',
    tag: 'profils · PIN · passkeys',
    span: 'lg:col-span-2',
  },
  {
    Icon: IconChartLine,
    title: 'Statistiques en direct',
    body: 'Téléchargements, scans de bibliothèque et lectures poussés en temps réel sur un bus WebSocket, vers les tableaux de bord et les clients.',
    tag: 'bus WebSocket',
    span: 'lg:col-span-2',
  },
] as const;

export function FeatureGrid() {
  return (
    <Section
      id="fonctionnalites"
      eyebrow="Tout est inclus"
      title="Toute la chaîne, dans un seul process"
      intro="Trouvez, téléchargez, organisez, diffusez. Chaque maillon d’une médiathèque auto-hébergée, écrit une fois et partagé — sans rien à câbler entre eux."
    >
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map(({ Icon, title, body, tag, span }) => (
            <div
              key={title}
              className={`group flex flex-col bg-surface-1/40 p-6 transition-colors duration-200 hover:bg-surface-1 ${span}`}
            >
              <Icon
                size={22}
                stroke={1.75}
                className="text-accent transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
              />
              <h3 className="mt-4 font-display text-lg font-bold leading-snug text-text">
                {title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{body}</p>
              <p className="mt-4 font-mono text-[0.72rem] tracking-tight text-dim">{tag}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
