import { collectGenres, type GenreCount } from '@kroma/core';
import { useT } from '@kroma/ui';
import { IconCategory } from '@tabler/icons-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { isAuthed } from '#web/shared/lib/api';
import { catalogQueries } from '#web/shared/lib/queries';
import { EmptyState, PAGE_MAIN, PAGE_TITLE, SkeletonRow } from '#web/shared/ui';

export const Route = createFileRoute('/_app/genres')({
  loader: async ({ context: { queryClient } }) => {
    if (!isAuthed()) return;
    await Promise.all([
      queryClient.ensureQueryData(catalogQueries.moviesView()),
      queryClient.ensureQueryData(catalogQueries.showsView()),
    ]);
  },
  pendingComponent: GenresPending,
  component: GenresPage,
});

function GenresPending() {
  const t = useT();
  return (
    <main className={PAGE_MAIN}>
      <h1 className={PAGE_TITLE}>{t('nav.genres')}</h1>
      <div className="mt-6">
        <SkeletonRow count={10} />
      </div>
    </main>
  );
}

function GenresPage() {
  const t = useT();
  const { data: movies } = useSuspenseQuery(catalogQueries.moviesView());
  const { data: shows } = useSuspenseQuery(catalogQueries.showsView());

  // Genres are derived from the whole catalogue (movies + shows), already
  // localized server-side, ranked most-common first.
  const genres = useMemo(() => collectGenres([...movies, ...shows]), [movies, shows]);

  return (
    <main className={PAGE_MAIN}>
      <h1 className={PAGE_TITLE}>{t('nav.genres')}</h1>
      {genres.length === 0 ? (
        <EmptyState icon={<IconCategory size={32} stroke={1.5} />} title={t('genres.empty')} />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {genres.map((g) => (
            <GenreTile key={g.name} genre={g} count={t('person.titleCount', { count: g.count })} />
          ))}
        </div>
      )}
    </main>
  );
}

/** A tappable genre card leading to its full grid. */
function GenreTile({ genre, count }: Readonly<{ genre: GenreCount; count: string }>) {
  return (
    <Link
      to="/genre/$genre"
      params={{ genre: genre.name }}
      className="group relative flex min-h-[96px] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] px-5 py-4 no-underline transition-colors hover:border-accent/40 hover:bg-white/[0.08]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_100%_0%,rgba(242,180,66,.10),transparent_60%)] opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative font-display text-[18px] font-bold leading-tight tracking-[-.01em] text-text">
        {genre.name}
      </span>
      <span className="relative text-[13px] font-medium text-dim tabular-nums">{count}</span>
    </Link>
  );
}
