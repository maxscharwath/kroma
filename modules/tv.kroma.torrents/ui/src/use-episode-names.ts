// What the provider calls each episode of one season, keyed by number.
//
// Both places that show a file list want it: a list of release strings is
// technically the truth and practically unreadable, and the episode titles are
// what an operator is actually checking against.

import { useEffect, useState } from 'react';
import { useTorrentsApi } from './api';
import type { EpisodeInfo } from './schemas';

const NONE: Map<number, EpisodeInfo> = new Map();

/** Episode names for `season` of `tmdbId`, or an empty map while they are
 *  unknown. Best-effort by design: a file list reads fine without them, so a
 *  failure is silent rather than an error the operator has to dismiss. */
export function useEpisodeNames(
  tmdbId: number | null | undefined,
  season: number | null | undefined,
): Map<number, EpisodeInfo> {
  const torrents = useTorrentsApi();
  const [names, setNames] = useState<Map<number, EpisodeInfo>>(NONE);

  useEffect(() => {
    if (!tmdbId || season === null || season === undefined) {
      setNames(NONE);
      return;
    }
    let live = true;
    torrents
      .episodes(tmdbId, season)
      .then((found) => {
        if (live) setNames(new Map(found.map((e) => [e.episode, e])));
      })
      .catch(() => {
        if (live) setNames(NONE);
      });
    return () => {
      live = false;
    };
  }, [torrents, tmdbId, season]);

  return names;
}
