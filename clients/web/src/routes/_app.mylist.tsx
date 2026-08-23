import {
  type DiscoverDetail,
  type DiscoverEntry,
  ItemId,
  type MessageKey,
  ShowId,
} from '@kroma/core';
import { useT } from '@kroma/ui';
import { Box, EmptyState, PageHeader } from '@kroma/ui/kit';

import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { type CatalogEntry, CatalogGrid, SectionHeading } from '#web/features/catalog/cards';
import { TileGrid } from '#web/features/catalog/tile-grid';
import { DiscoverCard } from '#web/features/requests/discover-card';
import { isAuthed, kromaClient } from '#web/shared/lib/api';
import { useMyList } from '#web/shared/lib/mylist';
import { catalogQueries } from '#web/shared/lib/queries';
import { useWatchLater } from '#web/shared/lib/watch-later';
import { PAGE_MAIN, SkeletonRow } from '#web/shared/ui';

export const Route = createFileRoute('/_app/mylist')({
  // The catalogue is public/SSR while the per-user list hydrates client-side,
  // so everything loads here and the component filters by the user's ids.
  loader: async ({ context: { queryClient } }) => {
    if (!isAuthed()) return;
    await Promise.all([
      queryClient.ensureQueryData(catalogQueries.moviesView()),
      queryClient.ensureQueryData(catalogQueries.showsView()),
    ]);
  },
  pendingComponent: MyListPending,
  component: MyListPage,
});

function MyListPending() {
  const t = useT();
  return (
    <main className={PAGE_MAIN}>
      <PageHeader.Root>
        <PageHeader.Title>{t('nav.myList')}</PageHeader.Title>
      </PageHeader.Root>
      <Box mt={24}>
        <SkeletonRow count={10} />
      </Box>
    </main>
  );
}

// Split a list of ids into local ids and `tmdb:` ids. Local ids resolve against
// the catalog views; tmdb ids need a discover detail fetch to render.
function splitIds(ids: readonly string[]): { local: string[]; tmdb: number[] } {
  const local: string[] = [];
  const tmdb: number[] = [];
  for (const id of ids) {
    if (id.startsWith('tmdb:')) {
      const num = Number(id.slice(5));
      if (!Number.isNaN(num)) tmdb.push(num);
    } else {
      local.push(id);
    }
  }
  return { local, tmdb };
}

// The discover detail endpoint takes `movie` | `tv`, but the queue stores only
// the numeric TMDB id. Try `movie` first; on failure try `tv`.
async function fetchDiscoverEntry(id: number): Promise<DiscoverEntry> {
  const client = kromaClient();
  try {
    const d = await client.discoverDetail('movie', id);
    return discoverEntryFromDetail(d);
  } catch {
    const d = await client.discoverDetail('tv', id);
    return discoverEntryFromDetail(d);
  }
}

function discoverEntryFromDetail(d: DiscoverDetail): DiscoverEntry {
  return {
    kind: d.kind,
    tmdbId: d.tmdbId,
    title: d.title,
    year: d.year,
    posterUrl: d.posterUrl,
    backdropUrl: d.backdropUrl,
    overview: d.overview,
    rating: d.rating,
    inLibrary: d.inLibrary,
    localId: d.localId,
    requestId: d.requestId,
    requestStatus: d.requestStatus,
    requestProgress: d.requestProgress,
  };
}

function useDiscoverEntries(ids: number[]): { entries: DiscoverEntry[]; loading: boolean } {
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['discover', 'entry', id] as const,
      queryFn: () => fetchDiscoverEntry(id),
      retry: 1,
    })),
  });
  const entries: DiscoverEntry[] = [];
  let loading = false;
  for (const q of queries) {
    if (q.isLoading) {
      loading = true;
      continue;
    }
    if (q.data) entries.push(q.data);
  }
  return { entries, loading };
}

function DiscoverGrid({ entries }: Readonly<{ entries: DiscoverEntry[] }>) {
  if (entries.length === 0) return null;
  return (
    <TileGrid>
      {(width) =>
        entries.map((e) => <DiscoverCard key={`tmdb:${e.tmdbId}`} entry={e} width={width} />)
      }
    </TileGrid>
  );
}

function ListSection({
  title,
  emptyKey,
  ready,
  local,
  tmdbEntries,
  tmdbLoading,
}: Readonly<{
  title: string;
  emptyKey: MessageKey;
  ready: boolean;
  local: CatalogEntry[];
  tmdbEntries: DiscoverEntry[];
  tmdbLoading: boolean;
}>) {
  const t = useT();
  const empty = ready && !tmdbLoading && local.length === 0 && tmdbEntries.length === 0;
  if (empty) {
    return (
      <EmptyState.Root icon="list-details">
        <EmptyState.Title>{t(emptyKey)}</EmptyState.Title>
      </EmptyState.Root>
    );
  }
  if (local.length === 0 && tmdbEntries.length === 0 && !ready) return null;
  return (
    <Box>
      <SectionHeading>{title}</SectionHeading>
      {local.length > 0 ? <CatalogGrid entries={local} /> : null}
      {tmdbEntries.length > 0 ? <DiscoverGrid entries={tmdbEntries} /> : null}
    </Box>
  );
}

function MyListPage() {
  const t = useT();
  const { data: movies } = useSuspenseQuery(catalogQueries.moviesView());
  const { data: shows } = useSuspenseQuery(catalogQueries.showsView());
  const { ids: myListIds, ready: myListReady } = useMyList();
  const { ids: watchLaterIds, ready: watchLaterReady } = useWatchLater();

  const movieById = new Map(movies.map((m) => [m.id, m]));
  const showById = new Map(shows.map((s) => [s.id, s]));

  function resolveLocal(ids: string[]): CatalogEntry[] {
    const out: CatalogEntry[] = [];
    for (const id of ids) {
      const movie = movieById.get(ItemId.of(id));
      if (movie) {
        out.push({ kind: 'movie', movie });
        continue;
      }
      const show = showById.get(ShowId.of(id));
      if (show) out.push({ kind: 'show', show });
    }
    return out;
  }

  const myListSplit = splitIds(myListIds);
  const myListLocal = resolveLocal(myListSplit.local);
  const myListTmdb = useDiscoverEntries(myListSplit.tmdb);

  const watchLaterSplit = splitIds(watchLaterIds);
  const watchLaterLocal = resolveLocal(watchLaterSplit.local);
  const watchLaterTmdb = useDiscoverEntries(watchLaterSplit.tmdb);

  const myListEmpty =
    myListReady &&
    !myListTmdb.loading &&
    myListLocal.length === 0 &&
    myListTmdb.entries.length === 0;
  const watchLaterEmpty =
    watchLaterReady &&
    !watchLaterTmdb.loading &&
    watchLaterLocal.length === 0 &&
    watchLaterTmdb.entries.length === 0;

  return (
    <main className={PAGE_MAIN}>
      <PageHeader.Root>
        <PageHeader.Title>{t('nav.myList')}</PageHeader.Title>
      </PageHeader.Root>

      {myListEmpty && watchLaterEmpty ? (
        <EmptyState.Root icon="list-details">
          <EmptyState.Title>{t('content.myListEmpty')}</EmptyState.Title>
        </EmptyState.Root>
      ) : (
        <Box mt={24} gap={40}>
          <ListSection
            title={t('nav.myList')}
            emptyKey="content.myListEmpty"
            ready={myListReady}
            local={myListLocal}
            tmdbEntries={myListTmdb.entries}
            tmdbLoading={myListTmdb.loading}
          />
          <ListSection
            title={t('discover.watchLater')}
            emptyKey="content.watchLaterEmpty"
            ready={watchLaterReady}
            local={watchLaterLocal}
            tmdbEntries={watchLaterTmdb.entries}
            tmdbLoading={watchLaterTmdb.loading}
          />
        </Box>
      )}
    </main>
  );
}
