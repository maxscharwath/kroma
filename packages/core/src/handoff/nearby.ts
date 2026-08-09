// The phone's list, merged from every way it has of finding a TV.
//
// A TV that is both heard on the link and listed by the server is one row, not
// two. Which copy wins matters: the heard one carries the proof that sends the
// grant down the stronger path, so `lan` beats `server` on a tie.

import type { DiscoveredTv, TvDiscoverySource } from './sources';

export interface NearbyWatchOptions {
  /** Every way this device has of finding TVs. An empty list is a device that
   * cannot look, and reports nothing rather than failing. */
  sources: TvDiscoverySource[];
  onRows: (rows: DiscoveredTv[]) => void;
}

// A row heard on the link wins: it is the one carrying the proof, and it is the
// one whose evidence of being in this room is worth more.
function better(a: DiscoveredTv, b: DiscoveredTv): DiscoveredTv {
  return a.via === 'lan' ? a : b;
}

function merge(views: Map<string, DiscoveredTv[]>): DiscoveredTv[] {
  const byHandle = new Map<string, DiscoveredTv>();
  for (const rows of views.values()) {
    for (const row of rows) {
      const seen = byHandle.get(row.handle);
      byHandle.set(row.handle, seen ? better(row, seen) : row);
    }
  }
  // Stable, so the list does not reshuffle under a thumb when one source
  // answers a beat after another.
  return [...byHandle.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.handle.localeCompare(b.handle),
  );
}

/**
 * Watch every source at once and report one merged list. Returns the stop
 * function, which stops all of them.
 *
 * Each source reports its whole view, never a delta, so a source going quiet
 * leaves its last view standing rather than blanking the list. That is
 * deliberate: a dropped poll is not a TV that went away, and a list that
 * flickers empty is worse than one a few seconds stale.
 */
export function watchNearbyTvs(opts: NearbyWatchOptions): () => void {
  const { sources, onRows } = opts;
  const views = new Map<string, DiscoveredTv[]>();
  let stopped = false;

  const stops = sources.map((source) =>
    source.start((rows) => {
      if (stopped) return;
      views.set(source.id, rows);
      onRows(merge(views));
    }),
  );

  return () => {
    stopped = true;
    for (const stop of stops) stop();
  };
}
