import { redirect } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { DiscoverDetailView } from '#web/features/requests/discoverDetail';
import { lumaClient } from '#web/shared/lib/api';

export const Route = createFileRoute('/discover/$type/$tmdbId')({
  loader: async ({ params }) => {
    const kind = params.type === 'tv' ? 'tv' : params.type === 'movie' ? 'movie' : null;
    if (!kind) throw redirect({ to: '/search' });
    const detail = await lumaClient().discoverDetail(kind, Number(params.tmdbId));
    // Already fully in the library: send the user to the real fiche instead.
    if (detail.inLibrary && detail.localId) {
      throw redirect({
        to: detail.kind === 'show' ? '/show/$id' : '/movie/$id',
        params: { id: detail.localId },
      });
    }
    return detail;
  },
  component: DiscoverRoute,
});

function DiscoverRoute() {
  const detail = Route.useLoaderData();
  return <DiscoverDetailView initial={detail} />;
}
