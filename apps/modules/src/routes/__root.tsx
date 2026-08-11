import bricolageLatin from '@kroma/ui/src/assets/fonts/bricolage-grotesque-latin.woff2?url';
import hankenLatin from '@kroma/ui/src/assets/fonts/hanken-grotesk-latin.woff2?url';
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '#site/styles.css?url';

// The faces are `font-display: optional`, so they only ever paint if they beat
// the browser's short block window; discovered from the stylesheet they arrive
// after first paint and are dropped for that view. Preloading starts them with
// the document instead. `crossorigin` is not optional here: a font fetched
// without it does not match the preload and is requested twice.
const FONT_PRELOAD = [hankenLatin, bricolageLatin].map((href) => ({
  rel: 'preload',
  href,
  as: 'font',
  type: 'font/woff2',
  crossOrigin: 'anonymous' as const,
}));

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#0A0A0C' },
      { title: 'KROMA Modules' },
      {
        name: 'description',
        content:
          "The module registry for KROMA: downloads, indexers, VPN, transcription and more, installed straight from your server's admin.",
      },
    ],
    links: [
      ...FONT_PRELOAD,
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      // Autodiscovery: KROMA servers follow this when handed the site URL
      // instead of the raw catalog (see docs/module-registries.md).
      { rel: 'kroma-modules', href: '/modules.json' },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
