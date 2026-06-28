import {
  type Activity,
  discoverServer,
  forgetServer as forgetServerStore,
  LumaClient,
  LumaEvents,
  loadSession,
  type MediaItem,
  normalizeServerUrl as norm,
  type SavedServer,
  type Show,
  saveServer as saveServerStore,
} from '@luma/core';
import { LumaIntro } from '@luma/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from '#tv/auth';
import { type Connection, ConnectionProvider, useConnection } from '#tv/connection';
import { ContinueProvider } from '#tv/continue';
import { type RedirectRule, resolveRedirect } from '#tv/guard';
import { LocaleProvider } from '#tv/locale';
import { MyListProvider } from '#tv/mylist';
import { type DeepLink, onDeepLink, publishPreview, readDeepLink } from '#tv/preview';
import {
  type RouteName,
  TvClientProvider,
  TvNavProvider,
  TvOutlet,
  type TvScreens,
  useNav,
} from '#tv/router';
import { initialServers } from '#tv/server';
import { TvAddProfile } from '#tv/TvAddProfile';
import { TvConnect } from '#tv/TvConnect';
import { TvGrid } from '#tv/TvGrid';
import { TvHome } from '#tv/TvHome';
import { TvMovieDetail } from '#tv/TvMovieDetail';
import { TvPin } from '#tv/TvPin';
import { TvPlayer } from '#tv/TvPlayer';
import { TvProfileMenu, TvProfiles, TvQuickConnect } from '#tv/TvProfiles';
import { TvSearch } from '#tv/TvSearch';
import { TvShowDetail } from '#tv/TvShowDetail';

export interface TvAppProps {
  /** Platform label shown in diagnostics, e.g. "Tizen" / "webOS". */
  platform?: string;
}

type Status = 'discovering' | 'connecting' | 'ready' | 'error';

/** A readable name for a server URL (saved label, else the host). */
function serverLabel(servers: SavedServer[], url: string | null): string | null {
  if (!url) return null;
  const saved = servers.find((s) => s.url === norm(url));
  if (saved?.name) return saved.name;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const EMPTY_ACTIVITY: Activity = {
  phase: 'idle',
  scanning: false,
  libraries: 0,
  shows: 0,
  items: 0,
  enrichDone: 0,
  enrichTotal: 0,
  probeDone: 0,
  probeTotal: 0,
  lastScanAt: null,
};
const base = (a: Activity | null): Activity => a ?? EMPTY_ACTIVITY;

// The brand intro plays once per launch. sessionStorage survives Vite HMR (so dev
// reloads don't replay it) but is fresh on a real TV cold-start.
const INTRO_SEEN_KEY = 'luma:intro-seen';
const introAlreadySeen = (() => {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
})();

export function TvApp({ platform = 'TV' }: Readonly<TvAppProps>) {
  // The session present at boot — used to point the first client at the right
  // server with its token already applied (no flicker on "Reprendre").
  const bootSession = useMemo(() => loadSession(), []);
  const [servers, setServers] = useState<SavedServer[]>(() => initialServers());
  const [activeServerUrl, setActiveUrl] = useState<string | null>(
    () => bootSession?.serverUrl ?? servers[0]?.url ?? null,
  );

  const client = useMemo<LumaClient | null>(() => {
    if (!activeServerUrl) return null;
    const token =
      bootSession && norm(bootSession.serverUrl ?? '') === norm(activeServerUrl)
        ? bootSession.token
        : undefined;
    return new LumaClient({ baseUrl: activeServerUrl, authToken: token });
    // bootSession is stable; rebuild only when the active server changes.
    // biome-ignore lint/correctness/useExhaustiveDependencies: bootSession is boot-stable.
  }, [activeServerUrl]);

  // Reported up by the auth provider; gates the catalogue + event stream so the
  // signed-out picker makes no requests at all.
  const [signedIn, setSignedIn] = useState(Boolean(bootSession));
  const [status, setStatus] = useState<Status>(activeServerUrl ? 'connecting' : 'discovering');
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [deepLink, setDeepLink] = useState<DeepLink | null>(() => readDeepLink());
  const [introDone, setIntroDone] = useState(introAlreadySeen);

  const setActiveServer = useCallback((url: string) => setActiveUrl(norm(url)), []);

  const addServer = useCallback((url: string, name?: string | null) => {
    const next = saveServerStore({ url, name });
    setServers(next);
    setActiveUrl(norm(url));
  }, []);

  const forgetServer = useCallback(
    (url: string) => {
      const u = norm(url);
      // Drop it from core storage (also clears its accounts + active session).
      forgetServerStore(u);
      const next = servers.filter((s) => s.url !== u);
      setServers(next);
      if (activeServerUrl && norm(activeServerUrl) === u) setActiveUrl(next[0]?.url ?? null);
    },
    [servers, activeServerUrl],
  );

  const discover = useCallback(() => {
    setDiscovering(true);
    let cancelled = false;
    void discoverServer().then((found) => {
      if (cancelled) return;
      setDiscovering(false);
      if (found) {
        setDiscovered((d) => (d.includes(found) ? d : [...d, found]));
        // First-run bootstrap: no servers yet → adopt the discovered one.
        if (servers.length === 0) addServer(found);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [servers.length, addServer]);

  // No saved servers → auto-discover on the LAN (first run).
  useEffect(() => {
    if (servers.length === 0) return discover();
    setStatus((s) => (s === 'discovering' ? 'connecting' : s));
  }, [servers.length, discover]);

  // Fetch the catalogue. `quiet` skips the status/error toggles (used by the live
  // refetch below — no "connecting" flicker, keep current data on a transient error).
  const fetchCatalogue = useCallback(async (c: LumaClient, quiet = false) => {
    if (!quiet) setStatus('connecting');
    try {
      const [mvs, shs] = await Promise.all([c.movies(), c.shows()]);
      setMovies(mvs);
      setShows(shs);
      if (!quiet) setStatus('ready');
    } catch (err) {
      if (!quiet) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    }
  }, []);

  // Load the catalogue only once a profile is active — the signed-out picker
  // stays silent (no /api/movies, /api/shows before sign-in).
  useEffect(() => {
    if (client && signedIn) void fetchCatalogue(client);
  }, [client, signedIn, fetchCatalogue]);

  // Live sync: hold the event stream open and refetch when the catalog changes.
  // A leading+trailing throttle coalesces bursts into at most one refetch/window.
  // Only while signed in — the picker keeps the stream (and /api/status) closed.
  useEffect(() => {
    if (!client || !signedIn) return;
    const MIN_MS = 2500;
    let last = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      last = Date.now();
      void fetchCatalogue(client, true);
    };
    const trigger = () => {
      const since = Date.now() - last;
      if (since >= MIN_MS) run();
      else {
        clearTimeout(trailing);
        trailing = setTimeout(run, MIN_MS - since);
      }
    };
    const events = new LumaEvents(client.baseUrl, {
      onOpen: () =>
        void client
          .status()
          .then(setActivity)
          .catch(() => undefined),
      onEvent: (e) => {
        switch (e.type) {
          case 'scan.started':
            setActivity((a) => ({ ...base(a), phase: 'scanning', scanning: true }));
            break;
          case 'scan.completed':
            setActivity((a) => ({
              ...base(a),
              phase: 'ready',
              scanning: false,
              libraries: e.libraries,
              shows: e.shows,
              items: e.items,
            }));
            trigger();
            break;
          case 'enrich.progress':
            setActivity((a) => ({
              ...base(a),
              phase: 'enriching',
              enrichDone: e.done,
              enrichTotal: e.total,
            }));
            break;
          case 'enrich.completed':
            setActivity((a) => ({
              ...base(a),
              phase: 'ready',
              enrichDone: e.resolved,
              enrichTotal: e.total,
            }));
            trigger();
            break;
          case 'library.updated':
          case 'item.updated':
          case 'show.updated':
            trigger();
            break;
          default:
            break;
        }
      },
    });
    events.connect();
    return () => {
      clearTimeout(trailing);
      events.close();
    };
  }, [client, signedIn, fetchCatalogue]);

  // Smart Hub preview (Samsung TV): keep the home-screen carousel in sync.
  useEffect(() => {
    if (status !== 'ready' || !client) return;
    const id = setTimeout(() => void publishPreview(client, movies), 1500);
    return () => clearTimeout(id);
  }, [status, client, movies]);

  useEffect(() => onDeepLink(setDeepLink), []);

  const connection = useMemo<Connection>(
    () => ({
      platform,
      status,
      servers,
      activeServerUrl,
      activeServerName: serverLabel(servers, activeServerUrl),
      error,
      client,
      movies,
      shows,
      activity,
      discovering,
      discovered,
      deepLink,
      addServer,
      setActiveServer,
      discover,
      forgetServer,
      clearDeepLink: () => setDeepLink(null),
    }),
    [
      platform,
      status,
      servers,
      activeServerUrl,
      error,
      client,
      movies,
      shows,
      activity,
      discovering,
      discovered,
      deepLink,
      addServer,
      setActiveServer,
      discover,
      forgetServer,
    ],
  );

  return (
    <>
      <TvNavProvider screens={SCREENS}>
        <ConnectionProvider value={connection}>
          <TvClientProvider client={client}>
            <AuthProvider
              client={client}
              activeServerUrl={activeServerUrl}
              setActiveServer={setActiveServer}
              onSignedInChange={setSignedIn}
            >
              <LocaleProvider client={client}>
                <ContinueProvider>
                  <MyListProvider>
                    <TvRouterGuard />
                  </MyListProvider>
                </ContinueProvider>
              </LocaleProvider>
            </AuthProvider>
          </TvClientProvider>
        </ConnectionProvider>
      </TvNavProvider>
      {introDone ? null : (
        <LumaIntro
          lite
          onDone={() => {
            try {
              sessionStorage.setItem(INTRO_SEEN_KEY, '1');
            } catch {
              /* ignore */
            }
            setIntroDone(true);
          }}
        />
      )}
    </>
  );
}

/** Route → component registry. Each screen reads its own data from hooks. */
const SCREENS: TvScreens = {
  connect: TvConnect,
  profiles: TvProfiles,
  addProfile: TvAddProfile,
  quick: TvQuickConnect,
  pin: TvPin,
  profileMenu: TvProfileMenu,
  home: TvHome,
  grid: TvGrid,
  search: TvSearch,
  movie: TvMovieDetail,
  show: TvShowDetail,
  player: TvPlayer,
};

// Screen groups for the navigation guard. The profile picker is the signed-out
// home even with no servers yet — it shows just "Ajouter un profil", which opens
// the wizard (where `connect` / "Ajouter manuellement" lives). So `connect` is an
// auth-flow screen, never the launch screen.
const AUTH_SCREENS = ['profiles', 'addProfile', 'connect', 'quick', 'pin'] as const; // signed out
const APP_SCREENS = [
  'home',
  'grid',
  'search',
  'movie',
  'show',
  'player',
  'profileMenu',
  'pin',
] as const; // signed in (pin: set/clear)

interface GuardState {
  signedIn: boolean;
}

type GuardTarget = 'profiles' | 'home';

// Declarative navigation policy (first match wins): signed-out → the picker /
// auth flow; signed-in → the app.
const GUARD: readonly RedirectRule<GuardState, RouteName, GuardTarget>[] = [
  { when: (s) => !s.signedIn, to: 'profiles', allow: AUTH_SCREENS },
  { when: () => true, to: 'home', allow: APP_SCREENS },
];

/** Drives the route from connection + session, then renders the routed screen. */
function TvRouterGuard() {
  const nav = useNav();
  const { deepLink, movies, shows, clearDeepLink } = useConnection();
  const { user } = useAuth();

  useEffect(() => {
    const target = resolveRedirect(GUARD, { signedIn: Boolean(user) }, nav.route.name);
    if (target) nav.replace(target);
  }, [user, nav]);

  // Apply a pending Smart-Hub deep link once signed in and its target is loaded.
  useEffect(() => {
    if (!user || !deepLink) return;
    if (deepLink.type === 'movie') {
      const movie = movies.find((m) => m.id === deepLink.id);
      if (movie) {
        nav.reset('movie', { item: movie });
        clearDeepLink();
      }
    } else {
      const show = shows.find((s) => s.id === deepLink.id);
      if (show) {
        nav.reset('show', { show });
        clearDeepLink();
      }
    }
  }, [user, deepLink, movies, shows, nav, clearDeepLink]);

  return <TvOutlet />;
}
