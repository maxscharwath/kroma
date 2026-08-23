import {
  type DiscoverDetail,
  type DiscoverEntry,
  ItemId,
  type MessageKey,
  ShowId,
} from '@kroma/core';
import { useT } from '@kroma/ui';
import { Box, EmptyState, PageHeader, SegmentGroup } from '@kroma/ui/kit';

import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { type CatalogEntry, CatalogGrid } from '#web/features/catalog/cards';
import { TileGrid } from '#web/features/catalog/tile-grid';
import { DiscoverCard } from '#web/features/requests/discover-card';
import { isAuthed, kromaClient, type MovieView, type ShowView } from '#web/shared/lib/api';
import { useMyList } from '#web/shared/lib/mylist';
import { catalogQueries } from '#web/shared/lib/queries';
import { useWatchLater } from '#web/shared/lib/watch-later';
import { useWatched } from '#web/shared/lib/watched';
import { PAGE_MAIN, SkeletonRow } from '#web/shared/ui';

type Tab = 'mylist' | 'watchlater' | 'watched';

export const Route = createFileRoute('/_app/mylist')({
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

async function fetchDiscoverEntry(id: number): Promise<DiscoverEntry> {
  const client = kromaClient();
  try {
    return discoverEntryFromDetail(await client.discoverDetail('movie', id));
  } catch {
    return discoverEntryFromDetail(await client.discoverDetail('tv', id));
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

interface ResolvedList {
  local: CatalogEntry[];
  tmdb: DiscoverEntry[];
  tmdbLoading: boolean;
  total: number;
  ready: boolean;
}

function useResolvedList(
  ids: readonly string[],
  ready: boolean,
  movieById: Map<string, MovieView>,
  showById: Map<string, ShowView>,
): ResolvedList {
  const split = splitIds(ids);
  const local: CatalogEntry[] = [];
  for (const id of split.local) {
    const movie = movieById.get(ItemId.of(id));
    if (movie) {
      local.push({ kind: 'movie', movie });
      continue;
    }
    const show = showById.get(ShowId.of(id));
    if (show) local.push({ kind: 'show', show });
  }
  const { entries, loading } = useDiscoverEntries(split.tmdb);
  return {
    local,
    tmdb: entries,
    tmdbLoading: loading,
    total: local.length + entries.length,
    ready,
  };
}

function ListContent({ list, emptyKey }: Readonly<{ list: ResolvedList; emptyKey: MessageKey }>) {
  const t = useT();
  if (list.ready && !list.tmdbLoading && list.total === 0) {
    return (
      <EmptyState.Root icon="list-details">
        <EmptyState.Title>{t(emptyKey)}</EmptyState.Title>
      </EmptyState.Root>
    );
  }
  if (list.total === 0 && !list.ready) return null;
  return (
    <Box>
      {list.local.length > 0 ? <CatalogGrid entries={list.local} /> : null}
      {list.tmdb.length > 0 ? <DiscoverGrid entries={list.tmdb} /> : null}
    </Box>
  );
}

function MyListPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('mylist');
  const { data: movies } = useSuspenseQuery(catalogQueries.moviesView());
  const { data: shows } = useSuspenseQuery(catalogQueries.showsView());
  const { ids: myListIds, ready: myListReady } = useMyList();
  const { ids: watchLaterIds, ready: watchLaterReady } = useWatchLater();
  const { ids: watchedIds, ready: watchedReady } = useWatched();

  const movieById = useMemo(() => new Map(movies.map((m) => [m.id, m])), [movies]);
  const showById = useMemo(() => new Map(shows.map((s) => [s.id, s])), [shows]);

  const myList = useResolvedList(myListIds, myListReady, movieById, showById);
  const watchLater = useResolvedList(watchLaterIds, watchLaterReady, movieById, showById);
  const watched = useResolvedList(watchedIds, watchedReady, movieById, showById);

  const allEmpty =
    myList.ready &&
    !myList.tmdbLoading &&
    myList.total === 0 &&
    watchLater.ready &&
    !watchLater.tmdbLoading &&
    watchLater.total === 0 &&
    watched.ready &&
    !watched.tmdbLoading &&
    watched.total === 0;

  const lists: Record<Tab, ResolvedList> = { mylist: myList, watchlater: watchLater, watched };
  const active = lists[tab];
  const emptyKeys: Record<Tab, MessageKey> = {
    mylist: 'content.myListEmpty',
    watchlater: 'content.watchLaterEmpty',
    watched: 'content.watchedEmpty',
  };
  const activeEmptyKey = emptyKeys[tab];

  return (
    <main className={PAGE_MAIN}>
      <PageHeader.Root>
        <PageHeader.Title>{t('nav.myList')}</PageHeader.Title>
      </PageHeader.Root>

      {allEmpty ? (
        <Box mt={24}>
          <EmptyState.Root icon="list-details">
            <EmptyState.Title>{t('content.myListEmpty')}</EmptyState.Title>
          </EmptyState.Root>
        </Box>
      ) : (
        <Box mt={24} gap={24}>
          <SegmentGroup.Root<Tab> value={tab} onValueChange={setTab} size="sm" stretch>
            <SegmentGroup.Item value="mylist">
              <SegmentGroup.Label>{t('nav.myList')}</SegmentGroup.Label>
            </SegmentGroup.Item>
            <SegmentGroup.Item value="watchlater">
              <SegmentGroup.Label>{t('discover.watchLater')}</SegmentGroup.Label>
            </SegmentGroup.Item>
            <SegmentGroup.Item value="watched">
              <SegmentGroup.Label>{t('content.watched')}</SegmentGroup.Label>
            </SegmentGroup.Item>
          </SegmentGroup.Root>

          <ListContent list={active} emptyKey={activeEmptyKey} />
        </Box>
      )}
    </main>
  );
}
