import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Player } from '#web/components/Player';
import { lumaClient, toMovieView } from '#web/lib/api';

export const Route = createFileRoute('/watch/$id')({
  loader: async ({ params }) => {
    const c = lumaClient();
    const item = await c.item(params.id);
    return { item: toMovieView(c, item) };
  },
  component: WatchPage,
});

function WatchPage() {
  const { item } = Route.useLoaderData();
  const navigate = useNavigate();
  return <Player item={item} onClose={() => navigate({ to: '/' })} />;
}
