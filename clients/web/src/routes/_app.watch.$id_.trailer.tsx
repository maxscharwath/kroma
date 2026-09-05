import { ItemId } from '@kroma/core';
import { createFileRoute } from '@tanstack/react-router';
import { WatchPending, WatchTrailerPage } from '#web/features/playback/watch-page';

export const Route = createFileRoute('/_app/watch/$id_/trailer')({
  pendingComponent: WatchPending,
  component: TrailerRoute,
});

function TrailerRoute() {
  const id = ItemId.parse(Route.useParams().id);
  return <WatchTrailerPage id={id} />;
}
