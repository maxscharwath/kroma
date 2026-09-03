import type { ItemId } from '@kroma/core';
import { color } from '@kroma/ui/kit';
import { type QueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { redirect, useNavigate } from '@tanstack/react-router';
import { Player } from '#web/features/playback/player';
import { isAuthed } from '#web/shared/lib/api';
import { catalogQueries } from '#web/shared/lib/queries';

export function trailerSearch(s: Record<string, unknown>): { trailer?: true } {
  return s.trailer === true || s.trailer === '1' || s.trailer === 'true' ? { trailer: true } : {};
}

export function WatchPending() {
  return <div style={{ position: 'fixed', inset: 0, background: color('black') }} />;
}

/** The next episode (for the "up next" autoplay) is sequence-based and public,
 * so it loads alongside the item. */
export async function ensureWatch(queryClient: QueryClient, id: ItemId, trailer: boolean) {
  if (!isAuthed()) throw redirect({ to: '/' });
  await queryClient.ensureQueryData(catalogQueries.watch(id, trailer));
}

export function WatchPage({ id, trailer }: { id: ItemId; trailer: boolean }) {
  const {
    data: { item, next, following },
  } = useSuspenseQuery(catalogQueries.watch(id, trailer));
  const navigate = useNavigate();
  return (
    <Player
      key={`${item.id}:${trailer ? 'trailer' : 'movie'}`}
      item={item}
      next={trailer ? null : next}
      following={trailer ? [] : following}
      onPlayNext={
        !trailer && next ? () => navigate({ to: '/watch/$id', params: { id: next.id } }) : undefined
      }
      onPlayItem={(nextId) => navigate({ to: '/watch/$id', params: { id: nextId } })}
      onGoHome={() => navigate({ to: '/', replace: true })}
      // Back returns to the detail page of what was playing: the series page for an
      // episode, otherwise the movie page (mirrors the catalog cards' deep-link rule).
      onClose={() =>
        item.kind === 'episode' && item.showId
          ? navigate({ to: '/shows/$id', params: { id: item.showId }, replace: true })
          : navigate({ to: '/movies/$id', params: { id: item.id }, replace: true })
      }
    />
  );
}
