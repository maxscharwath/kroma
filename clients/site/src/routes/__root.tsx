import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { SiteFooter } from '#site/components/site-footer';
import { SiteHeader } from '#site/components/site-header';
import { seo } from '#site/lib/seo';
import appCss from '#site/styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#0A0A0C' },
      ...seo().meta,
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      // The chromatic-wheel mark; SVG first, with the deep-charcoal tab colour.
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body className="page-grain bg-bg text-text antialiased">
        {/* The grain sits at z-0; everything real sits above it. */}
        <div className="relative z-10 flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
        <Scripts />
      </body>
    </html>
  );
}
