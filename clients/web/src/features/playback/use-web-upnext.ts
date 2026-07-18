import { formatRuntime, type MediaItem, metaLine } from '@kroma/core';
import type { UpNextData, UpNextItem } from '@kroma/ui';
import { useEffect, useMemo, useState } from 'react';
import { kromaClient } from '#web/shared/lib/api';

/** Map a media item to an up-next card (16:9 backdrop, runtime, context line). */
function toCard(item: MediaItem): UpNextItem {
  const c = kromaClient();
  const isEp = item.season != null && item.episode != null;
  return {
    id: item.id,
    title: isEp ? (item.episodeTitle ?? item.title) : item.title,
    subtitle: isEp ? `S${item.season} E${item.episode}` : metaLine(item),
    posterUrl: c.backdropFor(item) ?? c.posterFor(item),
    durationLabel: formatRuntime(item.durationMs),
    categoryLabel: item.metadata?.genres?.[0],
  };
}

/**
 * "À suivre" data (§10) for the web player: the immediate next episode plus
 * content-similar recommendations, mapped to the shared up-next card shape.
 */
export function useWebUpNext(item: MediaItem, next?: MediaItem | null): UpNextData {
  const [similar, setSimilar] = useState<MediaItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    kromaClient()
      .similar(item.id)
      .then((list) => !cancelled && setSimilar(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  return useMemo(
    () => ({
      nextEpisodes: next ? [toCard(next)] : [],
      recommendations: similar.slice(0, 18).map(toCard),
    }),
    [next, similar],
  );
}
