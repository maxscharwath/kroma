import type { ItemId } from '@kroma/core';
import { color } from '@kroma/ui/kit';
import { type QueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { redirect, useNavigate } from '@tanstack/react-router';
import { Player } from '#web/features/playback/player';
import { TrailerGate } from '#web/features/playback/trailer-gate';
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
export async function ensureWatch(queryClient: QueryClient, id: ItemId) {
  if (!isAuthed()) throw redirect({ to: '/' });
  await queryClient.ensureQueryData(catalogQueries.watch(id));
}

export function WatchPage({ id }: { id: ItemId }) {
  const {
    data: { item, next, following },
  } = useSuspenseQuery(catalogQueries.watch(id));
  const nav = useWatchNavigation();
  return (
    <Player
      key={item.id}
      item={item}
      next={next}
      following={following}
      onPlayNext={next ? () => nav.play(next.id) : undefined}
      onPlayItem={nav.play}
      onGoHome={nav.home}
      onClose={() => nav.back(item.kind === 'episode' ? item.showId : null, item.id)}
    />
  );
}

/** The trailer plays in the same player, minus everything that belongs to the
 * feature: no up-next, no episode rail, no progress. */
export function WatchTrailerPage({ id }: { id: ItemId }) {
  const nav = useWatchNavigation();
  return (
    <TrailerGate id={id}>
      {(clip) => (
        <Player
          key={`${clip.id}:trailer`}
          item={clip}
          next={null}
          following={[]}
          onPlayItem={nav.play}
          onGoHome={nav.home}
          onClose={() => nav.back(null, id)}
        />
      )}
    </TrailerGate>
  );
}

/** Back returns to the detail page of what was playing: the series page for an
 * episode, otherwise the movie page (mirrors the catalog cards' deep-link rule). */
function useWatchNavigation() {
  const navigate = useNavigate();
  return {
    play: (id: string) => {
      void navigate({ to: '/watch/$id', params: { id } });
    },
    home: () => {
      void navigate({ to: '/', replace: true });
    },
    back: (showId: string | null | undefined, id: ItemId) => {
      void (showId
        ? navigate({ to: '/shows/$id', params: { id: showId }, replace: true })
        : navigate({ to: '/movies/$id', params: { id }, replace: true }));
    },
  };
}
