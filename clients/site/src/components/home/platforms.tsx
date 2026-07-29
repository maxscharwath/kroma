import {
  IconBox,
  IconBrandAndroid,
  IconBrandApple,
  IconCast,
  IconCpu,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTv,
  IconServer,
  IconWorldWww,
  type TablerIcon,
} from '@tabler/icons-react';
import { Button } from '#site/components/button';
import { Section } from '#site/components/section';
import { type PlatformGroupId, type PlatformId, useHome } from '#site/lib/messages/home';
import { site } from '#site/lib/site';

// Platforms grouped by where they live rather than dropped into one flat grid of
// identical tiles, the grouping is the editorial choice. Each tile names the
// underlying runtime in mono (Tizen, webOS, .spk…) so the list reads as fact, not
// a logo wall. One codebase, one design language, every screen.
interface Group {
  id: PlatformGroupId;
  items: readonly { id: PlatformId; Icon: TablerIcon }[];
}

const GROUPS: readonly Group[] = [
  {
    id: 'screens',
    items: [
      { id: 'web', Icon: IconWorldWww },
      { id: 'mobile', Icon: IconDeviceMobile },
      { id: 'desktop', Icon: IconDeviceDesktop },
    ],
  },
  {
    id: 'televisions',
    items: [
      { id: 'samsung', Icon: IconDeviceTv },
      { id: 'lg', Icon: IconDeviceTv },
      { id: 'androidTv', Icon: IconBrandAndroid },
      { id: 'appleTv', Icon: IconBrandApple },
      { id: 'cast', Icon: IconCast },
    ],
  },
  {
    id: 'server',
    items: [
      { id: 'synology', Icon: IconServer },
      { id: 'docker', Icon: IconBox },
      { id: 'raspberryPi', Icon: IconCpu },
    ],
  },
];

export function Platforms() {
  const t = useHome().platforms;

  return (
    <Section id="plateformes" eyebrow={t.eyebrow} title={t.title} intro={t.intro}>
      <div className="flex flex-col gap-10">
        {GROUPS.map((group) => (
          <div key={group.id} className="grid gap-4 lg:grid-cols-[9rem_1fr] lg:gap-8">
            <p className="pt-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-dim">
              {t.groups[group.id]}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map(({ id, Icon }) => (
                <div
                  key={id}
                  className="flex items-center gap-3.5 rounded-xl border border-border bg-surface-1/40 px-4 py-3.5 transition-colors duration-200 hover:border-border-strong hover:bg-surface-1"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Icon size={19} stroke={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[0.95rem] font-semibold leading-tight text-text">
                      {t.items[id].name}
                    </p>
                    <p className="truncate font-mono text-[0.7rem] text-dim">
                      {t.items[id].detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        <Button to="/download">{t.install}</Button>
        <Button href={site.tvUrl} variant="outline">
          {t.tvDemo}
        </Button>
      </div>
    </Section>
  );
}
