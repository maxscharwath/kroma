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
} from '@tabler/icons-react';
import { Button } from '#site/components/button';
import { Section } from '#site/components/section';
import { site } from '#site/lib/site';

// Platforms grouped by where they live rather than dropped into one flat grid of
// identical tiles — the grouping is the editorial choice. Each tile names the
// underlying runtime in mono (Tizen, webOS, .spk…) so the list reads as fact, not
// a logo wall. One codebase, one design language, every screen.
const GROUPS = [
  {
    label: 'Écrans',
    items: [
      { Icon: IconWorldWww, name: 'Web', detail: 'navigateur · responsive' },
      { Icon: IconDeviceMobile, name: 'Mobile', detail: 'iPhone · iPad · Android' },
      { Icon: IconDeviceDesktop, name: 'Bureau', detail: 'macOS · Windows · Linux · Steam Deck' },
    ],
  },
  {
    label: 'Télévisions',
    items: [
      { Icon: IconDeviceTv, name: 'Samsung', detail: 'Tizen' },
      { Icon: IconDeviceTv, name: 'LG', detail: 'webOS' },
      { Icon: IconBrandAndroid, name: 'Android TV', detail: 'Google TV' },
      { Icon: IconBrandApple, name: 'Apple TV', detail: 'tvOS' },
      { Icon: IconCast, name: 'Cast', detail: 'téléphone → téléviseur' },
    ],
  },
  {
    label: 'Serveur',
    items: [
      { Icon: IconServer, name: 'Synology', detail: 'paquet .spk' },
      { Icon: IconBox, name: 'Docker', detail: 'image multi-arch' },
      { Icon: IconCpu, name: 'Raspberry Pi', detail: 'arm64 64-bit' },
    ],
  },
] as const;

export function Platforms() {
  return (
    <Section
      id="plateformes"
      eyebrow="Plateformes"
      title="Le même KROMA, sur chaque écran"
      intro="Les composants et les jetons de design existent une seule fois, dans un kit partagé, et se rendent nativement — du navigateur au salon piloté à la télécommande."
    >
      <div className="flex flex-col gap-10">
        {GROUPS.map((group) => (
          <div key={group.label} className="grid gap-4 lg:grid-cols-[9rem_1fr] lg:gap-8">
            <p className="pt-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-dim">
              {group.label}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-3.5 rounded-xl border border-border bg-surface-1/40 px-4 py-3.5 transition-colors duration-200 hover:border-border-strong hover:bg-surface-1"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <item.Icon size={19} stroke={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[0.95rem] font-semibold leading-tight text-text">
                      {item.name}
                    </p>
                    <p className="truncate font-mono text-[0.7rem] text-dim">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        <Button to="/download">Installer</Button>
        <Button href={site.tvUrl} variant="outline">
          Démo TV
        </Button>
      </div>
    </Section>
  );
}
