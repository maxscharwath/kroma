import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Sidebar } from '#web/components/Sidebar';
import { AuthGate } from '#web/components/AuthGate';
import { Intro } from '#web/components/Intro';
import { AuthProvider } from '#web/lib/auth';
import { apiBase } from '#web/lib/api';
import appCss from '#web/styles.css?url';

export const Route = createRootRoute({
  // Resolve the LUMA origin server-side; injected below for client navigations.
  loader: () => ({ apiBase: apiBase() }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'LUMA' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { apiBase: base } = Route.useLoaderData();
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-text">
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: `window.__LUMA_API__=${JSON.stringify(base)}` }}
        />
        <AuthProvider>
          <AuthGate />
          <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)]">
            <Sidebar />
            {children}
          </div>
        </AuthProvider>
        {/* Brand intro overlay — sits above everything, plays once per session. */}
        <Intro />
        <Scripts />
      </body>
    </html>
  );
}
