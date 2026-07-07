import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Player } from '#web/features/playback/Player';
import { authedLoad, toMovieView } from '#web/shared/lib/api';

export const Route = createFileRoute('/watch/$id')({
  loader: ({ params }) =>
    authedLoad(null, async (c) => {
      // The next episode (for the "up next" autoplay) is sequence-based, so it
      // loads alongside the item.
      const [item, next] = await Promise.all([c.item(params.id), c.nextEpisode(params.id)]);
      return { item: toMovieView(c, item), next };
    }),
  component: WatchPage,
});

function WatchPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  // Signed out (data null): the login overlay covers this route render nothing.
  if (!data) return null;
  const { item, next } = data;
  return (
    <Player
      key={item.id}
      item={item}
      next={next}
      onPlayNext={next ? () => navigate({ to: '/watch/$id', params: { id: next.id } }) : undefined}
      onClose={() => navigate({ to: '/' })}
    />
  );
}
