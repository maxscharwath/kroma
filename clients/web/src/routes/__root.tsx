import { ClientOnly, createRootRoute, HeadContent, Scripts, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AuthGate } from '#web/features/accounts/AuthGate';
import { Intro } from '#web/features/catalog/Intro';
import { Sidebar } from '#web/features/catalog/Sidebar';
import { AuthProvider } from '#web/shared/lib/auth';
import { LocaleProvider } from '#web/shared/lib/locale';
import { MyListProvider } from '#web/shared/lib/mylist';
import { WatchedProvider } from '#web/shared/lib/watched';
import appCss from '#web/styles.css?url';

export const Route = createRootRoute({
  // No apiBase injection: the SPA resolves the API origin at runtime (same origin
  // in the packaged build, VITE_LUMA_SERVER in dev see lib/api `apiBase`).
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

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // `lang` is the prerendered default; LocaleProvider updates it client-side to
    // match the active locale (account preference → device → browser).
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-text">
        {/* The Synology build ships as static files (no runtime SSR): TanStack
            Start only PRERENDERS a shell that the browser then hydrates. The app
            frame (auth, locale, sidebar) is driven by browser-only state
            (localStorage / navigator) the prerender can't see, so hydrating it
            against the shell mismatched and React bailed (errors #418/#423/#425).
            Rendering the app client-only makes the prerendered shell and the
            first client render identical (BootSplash), nothing to mismatch,
            then the real app renders once hydrated. */}
        <ClientOnly fallback={<BootSplash />}>
          <App>{children}</App>
        </ClientOnly>
        <Scripts />
      </body>
    </html>
  );
}

/** Provider-free, deterministic first paint shown until the client app hydrates.
 * Matches the login gate's backdrop so the handoff to <AuthGate> is seamless. */
function BootSplash() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'radial-gradient(120% 90% at 50% 0%, #15131C, #0A0A0C 70%)' }}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/15 border-t-accent" />
    </div>
  );
}

/** The live app frame. Rendered only on the client (see <ClientOnly> above), so
 * every provider is free to read browser storage/locale synchronously. */
function App({ children }: Readonly<{ children: ReactNode }>) {
  // The admin console (/admin/*) brings its own full-screen sidebar, so it
  // escapes the main app's two-column grid.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith('/admin');
  return (
    <>
      <AuthProvider>
        <WatchedProvider>
          <MyListProvider>
            <LocaleProvider>
              <AuthGate />
              {isAdmin ? (
                children
              ) : (
                <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)]">
                  <Sidebar />
                  {children}
                </div>
              )}
            </LocaleProvider>
          </MyListProvider>
        </WatchedProvider>
      </AuthProvider>
      {/* Brand intro overlay sits above everything, plays once per session. */}
      <Intro />
    </>
  );
}
