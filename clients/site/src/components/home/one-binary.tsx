import {
  IconArrowNarrowDown,
  IconArrowNarrowRight,
  IconCircleCheckFilled,
} from '@tabler/icons-react';
import { Container } from '#site/components/container';
import { WheelMark } from '#site/components/wheel-mark';
import { useLang } from '#site/lib/i18n';

// The differentiator, made literal: the stack a typical *arr setup bolts together
// on the left, the single server that replaces it on the right. Product names on
// the left are language-invariant; only the one-word job each used to own is
// localized, so the collapse reads as "these six things, one server to install"
// in either language. The right rail lists what that one server does natively.
const copy = {
  fr: {
    eyebrow: 'Un seul serveur',
    headingPre: 'Six conteneurs. ',
    headingAccent: 'Un seul serveur.',
    lead: 'Une installation classique boulonne ensemble une demi-douzaine de services, six configs, six choses qui cassent, jamais au même moment. KROMA les remplace par un seul serveur Rust qui démarre en millisecondes et ne garde aucune ferme de transcodage au chaud.',
    beforeLabel: 'Avant · six conteneurs',
    badge: '1 serveur',
    replaces: [
      { name: 'Sonarr · Radarr', role: 'acquisition' },
      { name: 'Prowlarr / Jackett', role: 'indexeurs' },
      { name: 'qBittorrent', role: 'téléchargement' },
      { name: 'Gluetun', role: 'VPN + kill-switch' },
      { name: 'Jellyfin', role: 'serveur + lecteur' },
      { name: 'Overseerr', role: 'requêtes' },
    ],
    native: [
      'Indexeurs Cardigann + Torznab',
      'Moteur BitTorrent librqbit',
      'Décision de qualité, import et renommage',
      'Pont WireGuard → SOCKS5 avec kill-switch',
      'Lecteur direct-play, HEVC natif',
    ],
  },
  en: {
    eyebrow: 'A single server',
    headingPre: 'Six containers. ',
    headingAccent: 'One server.',
    lead: 'A typical setup bolts together half a dozen services: six configs, six things that break, never at the same time. KROMA replaces them with a single Rust server that starts in milliseconds and keeps no transcoding farm warm.',
    beforeLabel: 'Before · six containers',
    badge: '1 server',
    replaces: [
      { name: 'Sonarr · Radarr', role: 'acquisition' },
      { name: 'Prowlarr / Jackett', role: 'indexers' },
      { name: 'qBittorrent', role: 'downloading' },
      { name: 'Gluetun', role: 'VPN + kill-switch' },
      { name: 'Jellyfin', role: 'server + player' },
      { name: 'Overseerr', role: 'requests' },
    ],
    native: [
      'Cardigann + Torznab indexers',
      'librqbit BitTorrent engine',
      'Quality decisions, import and renaming',
      'WireGuard → SOCKS5 bridge with kill-switch',
      'Direct-play player, native HEVC',
    ],
  },
} as const;

export function OneBinary() {
  const t = copy[useLang()];

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
            {t.eyebrow}
          </p>
          <h2 className="text-balance font-display text-3xl font-extrabold leading-[1.05] text-text sm:text-4xl">
            {t.headingPre}
            <span className="text-gradient-amber">{t.headingAccent}</span>
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted">{t.lead}</p>
        </div>

        <div className="mt-14 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          {/* AVANT, the pile of parts you no longer run. Dimmed and struck to
              read as "gone", not as a competing feature list. */}
          <div className="opacity-80">
            <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-dim">
              {t.beforeLabel}
            </p>
            <ul className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-surface-1/30">
              {t.replaces.map((s) => (
                <li key={s.name} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <span className="font-display text-[0.95rem] font-semibold text-muted line-through decoration-border-strong decoration-1">
                    {s.name}
                  </span>
                  <span className="shrink-0 font-mono text-[0.68rem] text-dim">{s.role}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* The collapse: down on a phone, right on desktop. */}
          <div className="flex items-center justify-center text-accent" aria-hidden>
            <IconArrowNarrowDown size={30} stroke={1.5} className="lg:hidden" />
            <IconArrowNarrowRight size={44} stroke={1.5} className="hidden lg:block" />
          </div>

          {/* APRÈS, one panel, lit from the top like the app's raised cards. */}
          <div className="surface-hairline relative overflow-hidden rounded-2xl border border-accent/30 bg-surface-1 p-6 shadow-card">
            <div className="glow-amber pointer-events-none absolute inset-x-0 -top-20 h-44" />
            <div className="relative flex items-center gap-3">
              <WheelMark size={30} />
              <span className="font-display text-xl font-extrabold tracking-tight text-text">
                KROMA
              </span>
              <span className="ml-auto rounded-full border border-border-strong px-2.5 py-0.5 font-mono text-[0.68rem] text-muted">
                {t.badge}
              </span>
            </div>
            <ul className="relative mt-5 flex flex-col gap-2.5">
              {t.native.map((n) => (
                <li key={n} className="flex items-start gap-2.5 text-sm text-muted">
                  <IconCircleCheckFilled
                    size={16}
                    stroke={1.75}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-accent"
                  />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
