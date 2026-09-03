import { ItemId } from '@kroma/core';
import { createFileRoute } from '@tanstack/react-router';
import { ensureWatch, WatchPage, WatchPending } from '#web/features/playback/watch-page';

export const Route = createFileRoute('/_app/watch/$id_/trailer')({
  loader: async ({ params, context: { queryClient } }) => {
    await ensureWatch(queryClient, ItemId.parse(params.id), true);
  },
  pendingComponent: WatchPending,
  component: WatchTrailerPage,
});

function WatchTrailerPage() {
  const id = ItemId.parse(Route.useParams().id);
  return <WatchPage id={id} trailer={true} />;
}
