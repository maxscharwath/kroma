// LUMA API origin resolution.
//
// Production (the single-binary Synology package): the Rust server serves THIS
// SPA *and* the API on the same origin, so we call the page's own origin and
// there's nothing to configure. Dev: the web (vite :3000) and API (:4040) are
// separate origins, so a build-time `VITE_LUMA_SERVER` points at the API.
// `window.__LUMA_API__` (if injected) still wins, for embedding flexibility.
import {
  isTextSubtitle,
  loadMediaToken,
  loadSession,
  LumaApiError,
  LumaClient,
  type MediaItem,
  type Show,
  withToken,
} from '@luma/core';

declare global {
  interface Window {
    __LUMA_API__?: string;
  }
}

const DEFAULT_BASE = 'http://localhost:4040';

/** The LUMA server origin (no trailing slash). */
export function apiBase(): string {
  // 1) Explicit runtime override (rare).
  if (typeof window !== 'undefined' && window.__LUMA_API__) {
    return window.__LUMA_API__.replace(/\/+$/, '');
  }
  // 2) Build-time override set in dev/staging to point at a specific API.
  const envBase = import.meta.env?.VITE_LUMA_SERVER;
  if (envBase) return envBase.replace(/\/+$/, '');
  // 3) Dev (vite): same-origin the Vite dev server reverse-proxies `/api`
  //    (incl. the events WebSocket) to the Rust server, so the whole app lives
  //    on one port (`:3000`). Just call the page origin, like production. SSR /
  //    prerender (no window) falls back to the conventional local API.
  if (import.meta.env?.DEV) {
    return typeof window !== 'undefined'
      ? window.location.origin.replace(/\/+$/, '')
      : DEFAULT_BASE;
  }
  // 4) Production SPA: same origin as the page (the Rust server serves both).
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/+$/, '');
  // 5) SSR / prerender fallback.
  const env = typeof process !== 'undefined' ? process.env.LUMA_SERVER_URL : undefined;
  return (env ?? DEFAULT_BASE).replace(/\/+$/, '');
}

/** Wrap a route loader so it is safe to run against the auth-gated API:
 *  - signed out → resolve to `fallback` without fetching (the login overlay
 *    shows over the route; the AuthProvider invalidates the router on sign-in so
 *    the real data loads then);
 *  - signed in  → mint the media token first (so poster/stream URLs carry `?t=`),
 *    run the body, and on a 401 (an invalid/expired session) fall back rather
 *    than throwing, which would crash the whole app to an error screen.
 * `redirect`s and any non-401 error propagate unchanged. */
export async function authedLoad<T>(fallback: T, run: (c: LumaClient) => Promise<T>): Promise<T> {
  const c = lumaClient();
  if (!loadSession()?.token) return fallback;
  try {
    await c.ensureMediaToken();
    return await run(c);
  } catch (e) {
    if (e instanceof LumaApiError && e.status === 401) return fallback;
    throw e;
  }
}

export function lumaClient(): LumaClient {
  // Carry the active session token (if any) so route loaders which now run on
  // the client (SPA, no SSR) get per-user personalised catalogue DTOs, e.g. the
  // per-show progress on cards. `loadSession()` is storage-guarded (null on the
  // server), so this stays safe during the shell prerender.
  return new LumaClient({ baseUrl: apiBase(), authToken: loadSession()?.token });
}

/** Resolve a metadata image path (relative `/api/…` cached art, or an absolute
 * URL) against the LUMA origin. Works on both server and client. */
export function imageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Inline avatars (base64) and absolute (TMDB) URLs are used as-is, no LUMA auth.
  if (url.startsWith('data:') || /^https?:\/\//.test(url)) return url;
  // Our own cached art (`/api/images/…`) is behind the auth gate but loaded by
  // an <img> tag, so it authenticates via the short-lived `?t=` media token.
  return withToken(`${apiBase()}${url}`, loadMediaToken()?.token);
}

/** A subtitle track with its on-demand WebVTT URL (text subs only). */
export interface SubtitleView {
  index: number;
  language: string | null;
  codec: string;
  /** Text-based subs (subrip/ass/mov_text) can be served as WebVTT; image subs
   * (PGS/VobSub) cannot `url` is null then. */
  url: string | null;
  /** True for a generated subtitle (Whisper/translate), vs embedded. */
  downloaded?: boolean;
  /** Display label for a generated sub. */
  label?: string;
  /** The generated subtitle's id (for deletion); absent for embedded tracks. */
  subId?: string;
  /** Provider tag of a generated sub (`whisper`/`translate`), for the "IA" badge. */
  provider?: string;
}

/** A movie/episode with art + stream + subtitle URLs pre-resolved to absolute LUMA URLs. */
export interface MovieView extends MediaItem {
  poster: string;
  backdrop: string | null;
  stream: string;
  subs: SubtitleView[];
}

/** A show with art pre-resolved. */
export interface ShowView extends Show {
  poster: string;
  backdrop: string | null;
}

export function toMovieView(c: LumaClient, item: MediaItem): MovieView {
  const subs: SubtitleView[] = item.subtitles.map((s, index) => ({
    index,
    language: s.language,
    codec: s.codec,
    url: isTextSubtitle(s.codec) ? c.subtitleUrl(item.id, index) : null,
  }));
  return {
    ...item,
    poster: c.posterFor(item),
    backdrop: c.backdropFor(item),
    stream: c.streamUrl(item.id),
    subs,
  };
}

export function toShowView(c: LumaClient, show: Show): ShowView {
  return { ...show, poster: c.showPosterFor(show), backdrop: c.backdropFor(show) };
}
