import { ItemId } from '@kroma/core';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  ensureWatch,
  trailerSearch,
  WatchPage,
  WatchPending,
} from '#web/features/playback/watch-page';

export const Route = createFileRoute('/_app/watch/$id')({
  validateSearch: trailerSearch,
  beforeLoad: ({ search, params }) => {
    if (search.trailer) throw redirect({ to: '/watch/$id/trailer', params });
  },
  loader: async ({ params, context: { queryClient } }) => {
    await ensureWatch(queryClient, ItemId.parse(params.id), false);
  },
  pendingComponent: WatchPending,
  component: WatchMoviePage,
});

function WatchMoviePage() {
  const id = ItemId.parse(Route.useParams().id);
  return <WatchPage id={id} trailer={false} />;
}
