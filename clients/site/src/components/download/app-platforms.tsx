import {
  IconAlertTriangle,
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
import type { ReactNode } from 'react';
import { Callout } from '#site/components/download/callout';
import type { IconComponent } from '#site/components/download/icon';
import {
  PlatformFamily,
  type PlatformFamilyProps,
} from '#site/components/download/platform-family';
import { docs, useDownload } from '#site/lib/messages/download';
import { site } from '#site/lib/site';

/** The one-time-setup note: the icon is an editorial choice (a key for a setup, a
 *  triangle for a Gatekeeper prompt), the words come from the catalog. */
function note(icon: IconComponent, text: { tag: string; body: ReactNode }) {
  return (
    <Callout icon={icon} tag={text.tag}>
      {text.body}
    </Callout>
  );
}

/**
 * Step 2's body: every screen KROMA runs on, grouped by family. The families are
 * data, not four near-identical JSX blocks, so each device still gets the note and
 * the command that actually matters for it without the frame repeating. Device
 * names, extensions and commands are language-neutral and live here; every word a
 * reader parses comes from the catalog.
 */
export function AppPlatforms() {
  const t = useDownload().families;
  const families: readonly PlatformFamilyProps[] = [
    {
      icon: IconDeviceTv,
      title: t.tv.title,
      intro: t.tv.intro,
      docHref: docs.installGuide,
      entries: [
        {
          icon: IconDeviceTv,
          name: 'Samsung (Tizen)',
          artifacts: ['.wgt'],
          setup: note(IconKey, t.tv.samsung),
          code: `sdb connect 192.168.1.50
tizen install -n KROMA.wgt -t <device-id>`,
        },
        {
          icon: IconDeviceTvOld,
          name: 'LG (webOS 4.0+)',
          artifacts: ['.ipk'],
          setup: note(IconKey, t.tv.lg),
          code: `bun add -g @webos-tools/cli
ares-install tv.kroma.webos_*_all.ipk -d tv`,
        },
        {
          icon: IconBrandAndroid,
          name: 'Android TV / Google TV / Chromecast',
          artifacts: ['.apk'],
          setup: note(IconKey, t.tv.androidtv),
          code: `adb connect 192.168.1.60:5555
adb install -r KROMA-androidtv.apk`,
        },
        {
          icon: IconBrandApple,
          name: 'Apple TV',
          beta: true,
          setup: note(IconInfoCircle, t.tv.appletv),
        },
      ],
    },
    {
      icon: IconDeviceDesktop,
      title: t.computers.title,
      intro: t.computers.intro,
      docHref: docs.installGuide,
      entries: [
        {
          icon: IconBrandApple,
          name: 'macOS',
          artifacts: ['.dmg'],
          setup: note(IconAlertTriangle, t.computers.mac),
          code: 'xattr -dr com.apple.quarantine /Applications/KROMA.app',
        },
        {
          icon: IconBrandWindows,
          name: 'Windows',
          artifacts: ['.exe', '.msi'],
          setup: note(IconAlertTriangle, t.computers.win),
        },
        {
          icon: IconBrandDebian,
          name: t.computers.linuxName,
          artifacts: ['.AppImage', '.deb'],
          setup: note(IconInfoCircle, t.computers.linux),
          code: `chmod +x KROMA_*.AppImage && ./KROMA_*.AppImage
# .deb : sudo apt install ./KROMA_*.deb`,
        },
        {
          icon: IconDeviceGamepad2,
          name: 'Steam Deck',
          artifacts: ['.AppImage'],
          steps: t.computers.steamdeck,
        },
      ],
    },
    {
      icon: IconDeviceMobile,
      title: t.mobile.title,
      intro: t.mobile.intro,
      docHref: docs.beta,
      entries: [
        {
          icon: IconBrandApple,
          name: 'iPhone / iPad',
          beta: true,
          setup: note(IconInfoCircle, t.mobile.ios),
        },
        {
          icon: IconBrandAndroid,
          name: 'Android',
          beta: true,
          setup: note(IconInfoCircle, t.mobile.android),
        },
      ],
    },
    {
      icon: IconServer,
      title: t.nasWeb.title,
      intro: t.nasWeb.intro,
      docHref: docs.installGuide,
      entries: [
        {
          icon: IconWorld,
          name: t.nasWeb.webName,
          setup: note(IconInfoCircle, t.nasWeb.web),
          code: 'http://nas.local:4040',
          codeLabel: 'url',
        },
        {
          icon: IconServer,
          name: 'Synology',
          artifacts: ['.spk'],
          setup: note(IconRefresh, t.nasWeb.synology),
          steps: t.nasWeb.synologySteps,
          code: site.packagesUrl,
          codeLabel: t.nasWeb.sourceLabel,
          after: <p className="mt-3 text-sm leading-relaxed text-dim">{t.nasWeb.manual}</p>,
        },
      ],
    },
  ];

  return (
    <div className="space-y-14">
      {families.map((family) => (
        <PlatformFamily key={family.title} {...family} />
      ))}
    </div>
  );
}
