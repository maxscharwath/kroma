import {
  IconChartLine,
  IconDownload,
  IconPlayerPlay,
  IconShieldHalf,
  IconSparkles,
  IconTargetArrow,
  IconUsers,
  IconWorldSearch,
  type TablerIcon,
} from '@tabler/icons-react';
import { Section } from '#site/components/section';
import { type FeatureId, useHome } from '#site/lib/messages/home';

// Capabilities as a spec sheet, not eight identical gradient cards. The cells
// share hairlines (a `gap-px` grid over a `bg-border` sheet) so the block reads
// as one instrument panel; the first two span wider than the rest so the eye
// lands on the acquisition brain and the VPN first.
const FEATURES: readonly { id: FeatureId; Icon: TablerIcon; span: string }[] = [
  { id: 'acquisition', Icon: IconTargetArrow, span: 'lg:col-span-3 sm:col-span-2' },
  { id: 'vpn', Icon: IconShieldHalf, span: 'lg:col-span-3 sm:col-span-2' },
  { id: 'indexers', Icon: IconWorldSearch, span: 'lg:col-span-2' },
  { id: 'downloader', Icon: IconDownload, span: 'lg:col-span-2' },
  { id: 'player', Icon: IconPlayerPlay, span: 'lg:col-span-2' },
  { id: 'ai', Icon: IconSparkles, span: 'lg:col-span-2' },
  { id: 'users', Icon: IconUsers, span: 'lg:col-span-2' },
  { id: 'stats', Icon: IconChartLine, span: 'lg:col-span-2' },
];

export function FeatureGrid() {
  const t = useHome().features;

  return (
    <Section id="fonctionnalites" eyebrow={t.eyebrow} title={t.title} intro={t.intro}>
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map(({ id, Icon, span }) => (
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
              <p className="mt-4 font-mono text-[0.72rem] tracking-tight text-dim">
                {t.items[id].tag}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
