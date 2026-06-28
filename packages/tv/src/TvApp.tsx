import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Activity, discoverServer, LumaClient, LumaEvents, type MediaItem, type Show } from '@luma/core';
import { AuthProvider, useAuth } from '#tv/auth';
import { type Connection, ConnectionProvider, useConnection } from '#tv/connection';
import { ContinueProvider } from '#tv/continue';
import { type DeepLink, onDeepLink, publishPreview, readDeepLink } from '#tv/preview';
import { type TvScreens, TvClientProvider, TvNavProvider, TvOutlet, useNav } from '#tv/router';
import { initialServerUrl, setServerUrl } from '#tv/server';
import { TvConnect } from '#tv/TvConnect';
import { TvHome } from '#tv/TvHome';
import { TvMovieDetail } from '#tv/TvMovieDetail';
import { TvProfiles } from '#tv/TvProfiles';
import { TvShowDetail } from '#tv/TvShowDetail';
import { TvPlayer } from '#tv/TvPlayer';

export interface TvAppProps {
  /** Platform label shown in diagnostics, e.g. "Tizen" / "webOS". */
  platform?: string;
}

type Status = 'discovering' | 'connecting' | 'ready' | 'error';

const EMPTY_ACTIVITY: Activity = {
  phase: 'idle',
  scanning: false,
  libraries: 0,
  shows: 0,
  items: 0,
  enrichDone: 0,
  enrichTotal: 0,
  lastScanAt: null,
};
const base = (a: Activity | null): Activity => a ?? EMPTY_ACTIVITY;

export function TvApp({ platform = 'TV' }: TvAppProps) {
  const [serverUrl, setUrl] = useState<string | null>(() => initialServerUrl());
  const [client, setClient] = useState<LumaClient | null>(() =>
    serverUrl ? new LumaClient({ baseUrl: serverUrl }) : null,
  );
  const [status, setStatus] = useState<Status>(serverUrl ? 'connecting' : 'discovering');
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState('');
  // A movie/show the app was launched into from a Smart Hub preview tile.
  const [deepLink, setDeepLink] = useState<DeepLink | null>(() => readDeepLink());

  const connect = useCallback((url: string, persist = true) => {
    if (persist) setServerUrl(url);
    setUrl(url);
    setClient(new LumaClient({ baseUrl: url }));
  }, []);

  const discover = useCallback(() => {
    setStatus('discovering');
    let cancelled = false;
    void discoverServer().then((found) => {
      if (cancelled) return;
      if (found) connect(found);
      else setStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [connect]);

  // No saved/baked address → auto-discover on the LAN.
  useEffect(() => {
    if (!serverUrl) return discover();
  }, [serverUrl, discover]);

  const load = useCallback(async (c: LumaClient) => {
    setStatus('connecting');
    try {
      const [mvs, shs] = await Promise.all([c.movies(), c.shows()]);
      setMovies(mvs);
      setShows(shs);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (client) void load(client);
  }, [client, load]);

  // Quiet refetch (no "connecting" flicker) for live updates.
  const refresh = useCallback(async (c: LumaClient) => {
    try {
      const [mvs, shs] = await Promise.all([c.movies(), c.shows()]);
      setMovies(mvs);
      setShows(shs);
    } catch {
      /* keep current data on a transient error */
    }
  }, []);

  // Live sync: hold the event stream open and refetch when the catalog changes
  // (scan finished, or TMDB art resolved) — no relaunch needed. A leading+trailing
  // throttle coalesces bursts (e.g. enrichment of thousands of titles) into at
  // most one refetch per window.
  useEffect(() => {
    if (!client) return;
    const MIN_MS = 2500;
    let last = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      last = Date.now();
      void refresh(client);
    };
    const trigger = () => {
      const since = Date.now() - last;
      if (since >= MIN_MS) {
        run();
      } else {
        clearTimeout(trailing);
        trailing = setTimeout(run, MIN_MS - since);
      }
    };
    const events = new LumaEvents(client.baseUrl, {
      // On (re)connect, grab the current scan/enrich snapshot.
      onOpen: () => void client.status().then(setActivity).catch(() => undefined),
      onEvent: (e) => {
        switch (e.type) {
          case 'scan.started':
            setActivity((a) => ({ ...base(a), phase: 'scanning', scanning: true }));
            break;
          case 'scan.completed':
            setActivity((a) => ({ ...base(a), phase: 'ready', scanning: false, libraries: e.libraries, shows: e.shows, items: e.items }));
            trigger();
            break;
          case 'enrich.progress':
            setActivity((a) => ({ ...base(a), phase: 'enriching', enrichDone: e.done, enrichTotal: e.total }));
            break;
          case 'enrich.completed':
            setActivity((a) => ({ ...base(a), phase: 'ready', enrichDone: e.resolved, enrichTotal: e.total }));
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
  }, [client, refresh]);

  // Smart Hub preview (Samsung TV): keep the home-screen carousel (resume +
  // recently-added) in sync. Debounced so a burst of catalog updates coalesces.
  useEffect(() => {
    if (status !== 'ready' || !client) return;
    const id = setTimeout(() => void publishPreview(client, movies), 1500);
    return () => clearTimeout(id);
  }, [status, client, movies]);

  // Honour a tile selection that re-targets the app while it's already running.
  useEffect(() => onDeepLink(setDeepLink), []);

  // The router renders every screen — no view-gating `if`s. Each screen reads its
  // own data from hooks (useConnection / useAuth / useParams / useContinue), so the
  // registry holds bare components and <TvOutlet/> is prop-free.
  const connection = useMemo<Connection>(
    () => ({
      platform,
      status,
      serverUrl,
      error,
      client,
      movies,
      shows,
      activity,
      deepLink,
      connect,
      discover,
      clearDeepLink: () => setDeepLink(null),
    }),
    [platform, status, serverUrl, error, client, movies, shows, activity, deepLink, connect, discover],
  );

  return (
    <TvNavProvider screens={SCREENS}>
      <ConnectionProvider value={connection}>
        <TvClientProvider client={client}>
          <AuthProvider client={client}>
            <ContinueProvider>
              <TvRouterGuard />
            </ContinueProvider>
          </AuthProvider>
        </TvClientProvider>
      </ConnectionProvider>
    </TvNavProvider>
  );
}

/** Route → component registry (the "route tree"). Each screen is a bare component
 * that reads its own data from hooks — so `<TvOutlet/>` needs no props. */
const SCREENS: TvScreens = {
  connect: TvConnect,
  profiles: TvProfiles,
  home: TvHome,
  movie: TvMovieDetail,
  show: TvShowDetail,
  player: TvPlayer,
};

/** Drives the route from connection status + session and applies Smart-Hub deep
 * links, then renders the routed screen. Mounted inside every provider. */
function TvRouterGuard() {
  const nav = useNav();
  const { status, deepLink, movies, shows, clearDeepLink } = useConnection();
  const { user } = useAuth();

  // The single guard that replaces the old `if (!ready) return <TvConnect>` /
  // `if (!session) return <TvProfiles>` gates. `replace` = single-screen stack.
  useEffect(() => {
    const r = nav.route.name;
    if (status !== 'ready') {
      if (r !== 'connect') nav.replace('connect');
    } else if (!user) {
      if (r !== 'profiles') nav.replace('profiles');
    } else if (r === 'connect' || r === 'profiles') {
      nav.replace('home');
    }
  }, [status, user, nav]);

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

