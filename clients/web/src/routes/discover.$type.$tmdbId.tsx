import { useT } from '@luma/ui';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMemo } from 'react';
import { TitleDetail } from '#web/features/catalog/titleDetail';
import { authedLoad } from '#web/shared/lib/api';
import { useAuth } from '#web/shared/lib/auth';
import { buildTitleView } from '#web/shared/lib/titleView';

export const Route = createFileRoute('/discover/$type/$tmdbId')({
  loader: ({ params }) =>
    authedLoad(null, async (c) => {
      if (params.type !== 'tv' && params.type !== 'movie') throw redirect({ to: '/search' });
      const kind = params.type as 'movie' | 'tv';
      const detail = await c.discoverDetail(kind, Number(params.tmdbId));
      // Owned (fully OR partially) → the canonical local fiche, which now overlays
      // the season gaps itself. Only not-owned titles render on the discover route.
      if (detail.localId) {
        throw redirect({
          to: detail.kind === 'show' ? '/show/$id' : '/movie/$id',
          params: { id: detail.localId },
        });
      }
      return detail;
    }),
  component: DiscoverRoute,
});

function DiscoverRoute() {
  const t = useT();
  const { client, user } = useAuth();
  const detail = Route.useLoaderData();
  const view = useMemo(
    () => (detail ? buildTitleView(client, t, user, { source: 'discover', detail }) : null),
    [client, t, user, detail],
  );
  // Signed out (detail null): the login overlay covers this route render nothing.
  if (!detail || !view) return null;
  return <TitleDetail key={detail.tmdbId} initial={view} />;
}
