// Server origin resolution for TV shells. A TV can't sensibly default to its
// own host, so the default is, in order: a value entered on the connection
// screen (persisted in localStorage) > a build-time `VITE_LUMA_SERVER` baked in
// at deploy time > localhost.
const STORAGE_KEY = 'luma.serverUrl';

const ENV_DEFAULT = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  ?.VITE_LUMA_SERVER;

export function getServerUrl(fallback = ENV_DEFAULT || 'http://localhost:4040'): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * The address to use without any probing: a saved override, else the build-time
 * default, else `null` — in which case the app runs mDNS auto-discovery.
 */
export function initialServerUrl(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return ENV_DEFAULT ?? null;
}

export function setServerUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/+$/, ''));
  } catch {
    /* ignore */
  }
}
