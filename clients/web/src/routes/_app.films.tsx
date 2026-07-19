import { collectGenres, hasGenre, isSortMode, type SortMode, sortTitles } from '@kroma/core';
import { useT } from '@kroma/ui';
import { IconMovie } from '@tabler/icons-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { BrowseBar } from '#web/features/catalog/browse-bar';
import { MovieGrid } from '#web/features/catalog/cards';
import { isAuthed } from '#web/shared/lib/api';
import { catalogQueries } from '#web/shared/lib/queries';
import { EmptyState, PAGE_MAIN, PAGE_TITLE, SkeletonRow } from '#web/shared/ui';

interface BrowseSearch {
  sort?: SortMode;
  genre?: string;
}

export const Route = createFileRoute('/_app/films')({
  validateSearch: (s: Record<string, unknown>): BrowseSearch => {
    const out: BrowseSearch = {};
    if (isSortMode(s.sort)) out.sort = s.sort;
    if (typeof s.genre === 'string' && s.genre) out.genre = s.genre;
    return out;
  },
  loader: async ({ context: { queryClient } }) => {
    if (!isAuthed()) return;
    await queryClient.ensureQueryData(catalogQueries.moviesView());
  },
  pendingComponent: FilmsPending,
  component: FilmsPage,
});

function FilmsPending() {
  const t = useT();
  return (
    <main className={PAGE_MAIN}>
      <h1 className={PAGE_TITLE}>{t('nav.films')}</h1>
      <div className="mt-6">
        <SkeletonRow count={14} />
      </div>
    </main>
  );
}

function FilmsPage() {
  const t = useT();
  const { sort = 'added', genre } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: movies } = useSuspenseQuery(catalogQueries.moviesView());

  const genres = useMemo(() => collectGenres(movies), [movies]);
  const view = useMemo(() => {
    const filtered = genre ? movies.filter((m) => hasGenre(m, genre)) : movies;
    return sortTitles(filtered, sort);
  }, [movies, genre, sort]);

  return (
    <main className={PAGE_MAIN}>
      <h1 className={PAGE_TITLE}>{t('nav.films')}</h1>
      {movies.length === 0 ? (
        <EmptyState icon={<IconMovie size={32} stroke={1.5} />} title={t('content.filmsEmpty')} />
      ) : (
        <>
          <BrowseBar
            sort={sort}
            onSort={(mode) => navigate({ search: (p) => ({ ...p, sort: mode }) })}
            genres={genres}
            genre={genre}
            onGenre={(g) => navigate({ search: (p) => ({ ...p, genre: g }) })}
          />
          {view.length === 0 ? (
            <EmptyState icon={<IconMovie size={32} stroke={1.5} />} title={t('search.noResults')} />
          ) : (
            <MovieGrid movies={view} />
          )}
        </>
      )}
    </main>
  );
}
