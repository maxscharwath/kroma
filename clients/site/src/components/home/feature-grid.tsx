import {
  IconChartLine,
  IconDownload,
  IconPlayerPlay,
  IconShieldHalf,
  IconSparkles,
  type TablerIcon,
  IconTargetArrow,
  IconUsers,
  IconWorldSearch,
} from '@tabler/icons-react';
import { Section } from '#site/components/section';
import { type FeatureId, useHome } from '#site/lib/messages/home';

// Capabilities as a spec sheet, not eight identical gradient cards. The cells
// share hairlines (a `gap-px` grid over a `bg-border` sheet) so the block reads
// as one instrument panel; the first two span wider than the rest so the eye
// lands on the acquisition brain and the VPN first. The mono `tag` is the real
// name of the thing, which is what a developer trusts, so it stays here with the
// icon and the span; only the prose lives in the catalog.
const FEATURES: readonly { id: FeatureId; Icon: TablerIcon; span: string; tag: string }[] = [
  {
    id: 'acquisition',
    Icon: IconTargetArrow,
    span: 'lg:col-span-3 sm:col-span-2',
    tag: 'decision engine · wanted-list',
  },
  {
    id: 'vpn',
    Icon: IconShieldHalf,
    span: 'lg:col-span-3 sm:col-span-2',
    tag: 'WireGuard → SOCKS5',
  },
  { id: 'indexers', Icon: IconWorldSearch, span: 'lg:col-span-2', tag: 'Cardigann + Torznab' },
  { id: 'downloader', Icon: IconDownload, span: 'lg:col-span-2', tag: 'librqbit' },
  { id: 'player', Icon: IconPlayerPlay, span: 'lg:col-span-2', tag: 'HEVC/H.265 · range-streamed' },
  { id: 'ai', Icon: IconSparkles, span: 'lg:col-span-2', tag: 'on-device · Whisper' },
  { id: 'users', Icon: IconUsers, span: 'lg:col-span-2', tag: 'profiles · PIN · passkeys' },
  { id: 'stats', Icon: IconChartLine, span: 'lg:col-span-2', tag: 'WebSocket bus' },
];

export function FeatureGrid() {
  const t = useHome().features;

  return (
    <Section id="fonctionnalites" eyebrow={t.eyebrow} title={t.title} intro={t.intro}>
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map(({ id, Icon, span, tag }) => (
            <div
              key={id}
              className={`group flex flex-col bg-surface-1/40 p-6 transition-colors duration-200 hover:bg-surface-1 ${span}`}
            >
              <Icon
                size={22}
                stroke={1.75}
                aria-hidden
                className="text-accent transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
              />
              <h3 className="mt-4 font-display text-lg font-bold leading-snug text-text">
                {t.items[id].title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{t.items[id].body}</p>
              <p className="mt-4 font-mono text-[0.72rem] tracking-tight text-dim">{tag}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
