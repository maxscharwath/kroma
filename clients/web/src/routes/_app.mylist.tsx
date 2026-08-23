import {
  type DiscoverDetail,
  type DiscoverEntry,
  ItemId,
  type MessageKey,
  ShowId,
} from '@kroma/core';
import { useT } from '@kroma/ui';
import { Box, EmptyState, PageHeader, Row, SegmentGroup, Select } from '@kroma/ui/kit';

import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { type CatalogEntry, MoviePoster, ShowPoster } from '#web/features/catalog/cards';
import { TileGrid } from '#web/features/catalog/tile-grid';
import { DiscoverCard } from '#web/features/requests/discover-card';
import { isAuthed, kromaClient, type MovieView, type ShowView } from '#web/shared/lib/api';
import { useMyList } from '#web/shared/lib/mylist';
import { catalogQueries } from '#web/shared/lib/queries';
import { useWatchLater } from '#web/shared/lib/watch-later';
import { useWatched } from '#web/shared/lib/watched';
import { PAGE_MAIN, SkeletonRow } from '#web/shared/ui';

type Tab = 'mylist' | 'watchlater' | 'watched';
type Sort = 'title' | 'year' | 'rating' | 'recent';
type KindFilter = 'all' | 'movie' | 'show';
type DecadeFilter = 'all' | '2020s' | '2010s' | '2000s' | '1990s' | 'older';

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

interface UnifiedEntry {
  key: string;
  kind: 'movie' | 'show';
  title: string;
  year: number | null;
  rating: number | null;
  addedAt: string | null;
  render: (width: number) => React.ReactNode;
}

function toUnifiedLocal(entries: CatalogEntry[]): UnifiedEntry[] {
  return entries.map((e) => {
    if (e.kind === 'movie') {
      return {
        key: e.movie.id,
        kind: 'movie' as const,
        title: e.movie.title,
        year: e.movie.year ?? null,
        rating: e.movie.metadata?.rating ?? null,
        addedAt: e.movie.addedAt ?? null,
        render: (width: number) => <MoviePoster item={e.movie} width={width} />,
      };
    }
    return {
      key: e.show.id,
      kind: 'show' as const,
      title: e.show.title,
      year: e.show.year ?? null,
      rating: e.show.metadata?.rating ?? null,
      addedAt: e.show.addedAt ?? null,
      render: (width: number) => <ShowPoster show={e.show} width={width} />,
    };
  });
}

function toUnifiedDiscover(entries: DiscoverEntry[]): UnifiedEntry[] {
  return entries.map((e) => ({
    key: `tmdb:${e.tmdbId}`,
    kind: e.kind,
    title: e.title,
    year: e.year,
    rating: e.rating,
    addedAt: null,
    render: (width: number) => <DiscoverCard entry={e} width={width} />,
  }));
}

function sortEntries(entries: UnifiedEntry[], sort: Sort): UnifiedEntry[] {
  const sorted = [...entries];
  if (sort === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'year') {
    sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  } else if (sort === 'rating') {
    sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (sort === 'recent') {
    sorted.sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));
  }
  return sorted;
}

function filterByKind(entries: UnifiedEntry[], filter: KindFilter): UnifiedEntry[] {
  if (filter === 'all') return entries;
  return entries.filter((e) => e.kind === filter);
}

function filterByDecade(entries: UnifiedEntry[], decade: DecadeFilter): UnifiedEntry[] {
  if (decade === 'all') return entries;
  return entries.filter((e) => {
    const y = e.year;
    if (y == null) return false;
    if (decade === '2020s') return y >= 2020;
    if (decade === '2010s') return y >= 2010 && y < 2020;
    if (decade === '2000s') return y >= 2000 && y < 2010;
    if (decade === '1990s') return y >= 1990 && y < 2000;
    if (decade === 'older') return y < 1990;
    return true;
  });
}

interface ResolvedList {
  entries: UnifiedEntry[];
  loading: boolean;
  total: number;
  ready: boolean;
}

function useResolvedList(
  ids: readonly string[],
  ready: boolean,
  movieById: Map<string, MovieView>,
  showById: Map<string, ShowView>,
): ResolvedList {
  const split = useMemo(() => splitIds(ids), [ids]);
  const local = useMemo(() => {
    const out: CatalogEntry[] = [];
    for (const id of split.local) {
      const movie = movieById.get(ItemId.of(id));
      if (movie) {
        out.push({ kind: 'movie', movie });
        continue;
      }
      const show = showById.get(ShowId.of(id));
      if (show) out.push({ kind: 'show', show });
    }
    return out;
  }, [split.local, movieById, showById]);
  const { entries, loading } = useDiscoverEntries(split.tmdb);
  const unified = useMemo(
    () => [...toUnifiedLocal(local), ...toUnifiedDiscover(entries)],
    [local, entries],
  );
  return { entries: unified, loading, total: unified.length, ready };
}

function UnifiedGrid({ entries }: Readonly<{ entries: UnifiedEntry[] }>) {
  if (entries.length === 0) return null;
  return (
    <TileGrid>{(width) => entries.map((e) => <div key={e.key}>{e.render(width)}</div>)}</TileGrid>
  );
}

function ListContent({ list, emptyKey }: Readonly<{ list: ResolvedList; emptyKey: MessageKey }>) {
  const t = useT();
  const [sort, setSort] = useState<Sort>('title');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [decadeFilter, setDecadeFilter] = useState<DecadeFilter>('all');

  if (list.ready && !list.loading && list.total === 0) {
    return (
      <EmptyState.Root icon="list-details">
        <EmptyState.Title>{t(emptyKey)}</EmptyState.Title>
      </EmptyState.Root>
    );
  }
  if (list.total === 0 && !list.ready) return null;

  const byKind = filterByKind(list.entries, kindFilter);
  const byDecade = filterByDecade(byKind, decadeFilter);
  const sorted = sortEntries(byDecade, sort);
  const movieCount = list.entries.filter((e) => e.kind === 'movie').length;
  const showCount = list.entries.filter((e) => e.kind === 'show').length;

  return (
    <Box gap={16}>
      <Row gap={12} align="center" wrap>
        <Select.Root
          label={t('content.filterAll')}
          value={kindFilter}
          onValueChange={(v) => setKindFilter(v as KindFilter)}
        >
          <Select.Trigger size="sm" />
          <Select.Item value="all" label={t('content.filterAll')} />
          <Select.Item value="movie" label={`${t('content.film')} (${movieCount})`} />
          <Select.Item value="show" label={`${t('content.series')} (${showCount})`} />
        </Select.Root>
        <Select.Root
          label={t('content.sortDecade')}
          value={decadeFilter}
          onValueChange={(v) => setDecadeFilter(v as DecadeFilter)}
        >
          <Select.Trigger size="sm" />
          <Select.Item value="all" label={t('content.filterAll')} />
          <Select.Item value="2020s" label="2020s" />
          <Select.Item value="2010s" label="2010s" />
          <Select.Item value="2000s" label="2000s" />
          <Select.Item value="1990s" label="1990s" />
          <Select.Item value="older" label={t('content.sortOlder')} />
        </Select.Root>
        <Select.Root
          label={t('content.sortTitle')}
          value={sort}
          onValueChange={(v) => setSort(v as Sort)}
        >
          <Select.Trigger size="sm" />
          <Select.Item value="title" label={t('content.sortTitle')} />
          <Select.Item value="year" label={t('content.sortYear')} />
          <Select.Item value="rating" label={t('content.sortRating')} />
          <Select.Item value="recent" label={t('content.sortRecent')} />
        </Select.Root>
      </Row>
      <UnifiedGrid entries={sorted} />
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
    !myList.loading &&
    myList.total === 0 &&
    watchLater.ready &&
    !watchLater.loading &&
    watchLater.total === 0 &&
    watched.ready &&
    !watched.loading &&
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
