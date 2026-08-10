import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '#site/styles.css?url';
import { themeBootScript } from '#ui/core/theme-mode';

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
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: stamps the stored theme before first paint; a component cannot run early enough. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
