import { redirect } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { DiscoverDetailView } from '#web/features/requests/discoverDetail';
import { lumaClient } from '#web/shared/lib/api';

export const Route = createFileRoute('/discover/$type/$tmdbId')({
  loader: async ({ params }) => {
    const kind = params.type === 'tv' ? 'tv' : params.type === 'movie' ? 'movie' : null;
    if (!kind) throw redirect({ to: '/search' });
    const detail = await lumaClient().discoverDetail(kind, Number(params.tmdbId));
    // Only send the user back to the real fiche when the title is FULLY in the
    // library. A show can be present but missing seasons - keep it here so the
    // season picker can request the gaps (that's the whole point of this page).
    const fullyAvailable =
      detail.kind === 'show'
        ? detail.seasons.length > 0 && detail.seasons.every((s) => s.available)
        : detail.inLibrary;
    if (fullyAvailable && detail.localId) {
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
