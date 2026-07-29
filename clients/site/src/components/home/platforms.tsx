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
import { useLang } from '#site/lib/i18n';
import { site } from '#site/lib/site';

// Platforms grouped by where they live rather than dropped into one flat grid of
// identical tiles, the grouping is the editorial choice. Each tile names the
// underlying runtime in mono (Tizen, webOS, .spk…) so the list reads as fact, not
// a logo wall. One codebase, one design language, every screen.
//
// Runtime names are language-invariant, so every localized field carries a
// per-locale pair even when the two are identical (Tizen, tvOS…); keeping the
// shape uniform is worth the little repetition versus a string|object union.
const GROUPS = [
  {
    label: { fr: 'Écrans', en: 'Screens' },
    items: [
      {
        Icon: IconWorldWww,
        name: { fr: 'Web', en: 'Web' },
        detail: { fr: 'navigateur · responsive', en: 'browser · responsive' },
      },
      {
        Icon: IconDeviceMobile,
        name: { fr: 'Mobile', en: 'Mobile' },
        detail: { fr: 'iPhone · iPad · Android', en: 'iPhone · iPad · Android' },
      },
      {
        Icon: IconDeviceDesktop,
        name: { fr: 'Bureau', en: 'Desktop' },
        detail: {
          fr: 'macOS · Windows · Linux · Steam Deck',
          en: 'macOS · Windows · Linux · Steam Deck',
        },
      },
    ],
  },
  {
    label: { fr: 'Télévisions', en: 'Televisions' },
    items: [
      {
        Icon: IconDeviceTv,
        name: { fr: 'Samsung', en: 'Samsung' },
        detail: { fr: 'Tizen', en: 'Tizen' },
      },
      { Icon: IconDeviceTv, name: { fr: 'LG', en: 'LG' }, detail: { fr: 'webOS', en: 'webOS' } },
      {
        Icon: IconBrandAndroid,
        name: { fr: 'Android TV', en: 'Android TV' },
        detail: { fr: 'Google TV', en: 'Google TV' },
      },
      {
        Icon: IconBrandApple,
        name: { fr: 'Apple TV', en: 'Apple TV' },
        detail: { fr: 'tvOS', en: 'tvOS' },
      },
      {
        Icon: IconCast,
        name: { fr: 'Cast', en: 'Cast' },
        detail: { fr: 'téléphone → téléviseur', en: 'phone → TV' },
      },
    ],
  },
  {
    label: { fr: 'Serveur', en: 'Server' },
    items: [
      {
        Icon: IconServer,
        name: { fr: 'Synology', en: 'Synology' },
        detail: { fr: 'paquet .spk', en: '.spk package' },
      },
      {
        Icon: IconBox,
        name: { fr: 'Docker', en: 'Docker' },
        detail: { fr: 'image multi-arch', en: 'multi-arch image' },
      },
      {
        Icon: IconCpu,
        name: { fr: 'Raspberry Pi', en: 'Raspberry Pi' },
        detail: { fr: 'arm64 64-bit', en: 'arm64 64-bit' },
      },
    ],
  },
] as const;

const copy = {
  fr: {
    eyebrow: 'Plateformes',
    title: 'Le même KROMA, sur chaque écran',
    intro:
      'Les composants et les jetons de design existent une seule fois, dans un kit partagé, et se rendent nativement, du navigateur au salon piloté à la télécommande.',
    install: 'Installer',
    tvDemo: 'Démo TV',
  },
  en: {
    eyebrow: 'Platforms',
    title: 'The same KROMA, on every screen',
    intro:
      'The components and design tokens exist once, in a shared kit, and render natively, from the browser to the living room driven by a remote.',
    install: 'Install',
    tvDemo: 'TV demo',
  },
} as const;

export function Platforms() {
  const lang = useLang();
  const t = copy[lang];

  return (
    <Section id="plateformes" eyebrow={t.eyebrow} title={t.title} intro={t.intro}>
      <div className="flex flex-col gap-10">
        {GROUPS.map((group) => (
          <div key={group.label.en} className="grid gap-4 lg:grid-cols-[9rem_1fr] lg:gap-8">
            <p className="pt-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-dim">
              {group.label[lang]}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <div
                  key={item.name.en}
                  className="flex items-center gap-3.5 rounded-xl border border-border bg-surface-1/40 px-4 py-3.5 transition-colors duration-200 hover:border-border-strong hover:bg-surface-1"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <item.Icon size={19} stroke={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[0.95rem] font-semibold leading-tight text-text">
                      {item.name[lang]}
                    </p>
                    <p className="truncate font-mono text-[0.7rem] text-dim">{item.detail[lang]}</p>
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
