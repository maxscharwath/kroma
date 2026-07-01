import { useEffect, useState } from 'react';

/** Slow cadence the picker list is informational, not the active-server heartbeat. */
const INTERVAL_MS = 12000;
/** A probe unanswered by now counts as unreachable (a dead host never refuses). */
const TIMEOUT_MS = 4000;

/**
 * Reachability of a set of servers for the profile picker: probes each
 * `<url>/api/health` on a slow loop and returns a `url → online` map (a url is
 * absent until its first probe answers). Meant for the *other* saved servers the
 * active one already has a live heartbeat driving `connection.online`, so pass
 * only the alternates here to avoid probing it twice.
 */
export function useServersHealth(urls: string[]): Record<string, boolean> {
  const [map, setMap] = useState<Record<string, boolean>>({});
  // Collapse to a stable primitive so the effect restarts only when the SET of
  // urls changes, not on every render's fresh array identity.
  const key = urls.join('|');

  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (list.length === 0) {
      setMap({});
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const probe = (url: string) => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      return fetch(`${url}/api/health`, { signal: ctrl.signal })
        .then((res) => ({ url, up: res.ok }))
        .catch(() => ({ url, up: false }))
        .finally(() => clearTimeout(to));
    };

    const round = async () => {
      const results = await Promise.all(list.map(probe));
      if (cancelled) return;
      setMap(Object.fromEntries(results.map((r) => [r.url, r.up])));
      timer = setTimeout(round, INTERVAL_MS);
    };
    void round();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  return map;
}
