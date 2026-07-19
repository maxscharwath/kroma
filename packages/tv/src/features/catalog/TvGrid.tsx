import {
  collectGenres,
  hasGenre,
  type KromaClient,
  type MediaItem,
  type MessageKey,
  posterColors,
  qualityBadge,
  qualityBadgeForVideo,
  type Show,
  SORT_MODES,
  type SortMode,
  sortTitles,
} from '@kroma/core';
import { useT } from '@kroma/ui';
import { useEffect, useMemo, useState } from 'react';
import { useConnection } from '#tv/app/providers/connection';
import { useMyList } from '#tv/app/providers/mylist';
import { useWatched } from '#tv/app/providers/watched';
import { useClient, useNav, useParams } from '#tv/app/router';
import { useFocusNav } from '#tv/app/useFocusNav';
import { TvTopNav } from '#tv/features/catalog/home/TopNav';
import { type GridCard, TvGrid as PosterGrid } from '#tv/features/catalog/home/TvGrid';
import { badgeClasses, TvArt } from '#tv/shared/TvMedia';

const SORT_LABEL_KEY: Record<SortMode, MessageKey> = {
  added: 'browse.sort.added',
  release: 'browse.sort.release',
  title: 'browse.sort.title',
  rating: 'browse.sort.rating',
};

// Season-selector chip (see TvShowDetail): amber when active, scale on focus.
// rgba() literal (not a `/opacity` modifier) for the legacy webOS tier.
const CHIP_CLS =
  'shrink-0 cursor-pointer rounded-full border-none bg-surface-2 px-4 py-1.75 font-sans text-[14px] font-semibold text-muted transition-transform focus:scale-[1.05] aria-[current=true]:bg-accent aria-[current=true]:text-accent-ink';

interface GridHero {
  hero: MediaItem | Show | null;
  heroBackdrop: string | null;
  heroBadge: string | null;
}

/** The hero title for a grid section (the first title of the current, filtered +
 * sorted view), with its backdrop art and quality badge. */
function computeGridHero(
  isSeries: boolean,
  films: MediaItem[],
  shows: Show[],
  client: KromaClient,
): GridHero {
  const heroMovie = isSeries ? undefined : films[0];
  const heroShow = heroMovie ? undefined : shows[0];
  const hero = heroMovie ?? heroShow ?? null;
  const heroBackdrop = hero ? (client.backdropFor(hero) ?? client.posterFor(hero)) : null;
  let heroBadge: string | null = null;
  if (heroMovie) heroBadge = qualityBadge(heroMovie);
  else if (heroShow) heroBadge = qualityBadgeForVideo(heroShow.video);
  return { hero, heroBackdrop, heroBadge };
}

/** Full-screen catalogue grid for one section (Films / Séries / Ma liste): a 44%
 * hero over the first title, a sort + genre control strip, then an
 * incrementally-rendered 2:3 poster grid. Shares the top nav with Home. */
export function TvGrid() {
  const { kind } = useParams('grid');
  const { movies, shows } = useConnection();
  const client = useClient();
  const t = useT();
  const nav = useNav();
  const myList = useMyList();
  const watched = useWatched();
  const isFilms = kind === 'films';
  const isSeries = kind === 'series';
  useFocusNav({ onBack: nav.back, resetKey: kind });

  const [sort, setSort] = useState<SortMode>('added');
  const [genre, setGenre] = useState<string | undefined>(undefined);
  // Films / Séries / Ma liste share this component (a top-nav jump swaps the param
  // without remounting), so clear the genre filter when the section changes it may
  // not exist in the other section's catalogue.
  // biome-ignore lint/correctness/useExhaustiveDependencies: kind is an intentional re-run key (resets the filter on a section switch), not read inside the effect
  useEffect(() => setGenre(undefined), [kind]);

  // Base lists for the active section, before genre filter + sort.
  const baseMovies = useMemo(() => {
    if (isFilms) return movies;
    if (isSeries) return [];
    return movies.filter((m) => myList.has(m.id));
  }, [isFilms, isSeries, movies, myList]);
  const baseShows = useMemo(() => {
    if (isSeries) return shows;
    if (isFilms) return [];
    return shows.filter((s) => myList.has(s.id));
  }, [isFilms, isSeries, shows, myList]);

  const genres = useMemo(
    () => collectGenres([...baseMovies, ...baseShows]),
    [baseMovies, baseShows],
  );

  const [filmList, showList] = useMemo(() => {
    const keep = (it: MediaItem | Show) => !genre || hasGenre(it, genre);
    return [
      sortTitles(baseMovies.filter(keep), sort),
      sortTitles(baseShows.filter(keep), sort),
    ] as const;
  }, [baseMovies, baseShows, genre, sort]);

  const cards = useMemo<GridCard[]>(() => {
    const movieCard = (m: MediaItem): GridCard => ({
      id: m.id,
      title: m.title,
      poster: client.posterFor(m),
      colors: posterColors(m.id),
      watched: watched.has(m.id),
      onClick: () => nav.go('movie', { item: m }),
    });
    const showCard = (s: Show): GridCard => ({
      id: s.id,
      title: s.title,
      poster: client.showPosterFor(s),
      colors: posterColors(s.id),
      watched: watched.has(s.id),
      progress: s.progress ?? null,
      onClick: () => nav.go('show', { show: s }),
    });
    return [...filmList.map(movieCard), ...showList.map(showCard)];
  }, [filmList, showList, client, nav, watched]);

  const { hero, heroBackdrop, heroBadge } = computeGridHero(isSeries, filmList, showList, client);
  let label: string;
  if (isFilms) label = t('nav.films');
  else if (isSeries) label = t('nav.series');
  else label = t('nav.myList');
  const hasItems = baseMovies.length + baseShows.length > 0;
  const empty = kind === 'mylist' && cards.length === 0;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg">
      <section className="relative flex-[0_0_44%]">
        <TvArt
          src={heroBackdrop}
          colors={hero ? posterColors(hero.id) : ['#1c1c22', '#0a0a0c']}
          position="50% 22%"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0A0A0C_6%,transparent_62%),linear-gradient(0deg,#0A0A0C_2%,transparent_52%)]" />
        <TvTopNav active={kind} />
        {hero ? (
          <div className="absolute bottom-7 left-16 max-w-195">
            <div className="mb-3 font-sans text-[13px] font-bold uppercase tracking-[0.22em] text-accent">
              {label} · {cards.length}
            </div>
            <h1 className="m-0 mb-3 font-display text-[clamp(36px,6.2vh,68px)] font-bold leading-[0.98] tracking-[-0.02em]">
              {hero.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2.75 font-sans text-[16px] font-semibold text-muted">
              {hero.metadata?.rating ? (
                <>
                  <span className="font-bold text-accent">{hero.metadata.rating.toFixed(1)}★</span>
                  <span className="text-dim">·</span>
                </>
              ) : null}
              <span>{hero.year ?? ''}</span>
              {heroBadge ? <span className={badgeClasses(heroBadge)}>{heroBadge}</span> : null}
            </div>
          </div>
        ) : (
          <div className="absolute bottom-7 left-16">
            <div className="mb-3 font-sans text-[13px] font-bold uppercase tracking-[0.22em] text-accent">
              {label}
            </div>
          </div>
        )}
      </section>

      {hasItems ? (
        <div className="scrollbar-none flex shrink-0 items-center gap-2 overflow-x-auto px-16 py-3">
          {SORT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              data-focus=""
              aria-current={mode === sort}
              onClick={() => setSort(mode)}
              className={CHIP_CLS}
            >
              {t(SORT_LABEL_KEY[mode])}
            </button>
          ))}
          {genres.length > 0 ? (
            <>
              <span className="mx-1 h-6 w-px shrink-0 bg-[rgba(255,255,255,0.14)]" />
              <button
                type="button"
                data-focus=""
                aria-current={!genre}
                onClick={() => setGenre(undefined)}
                className={CHIP_CLS}
              >
                {t('browse.allGenres')}
              </button>
              {genres.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  data-focus=""
                  aria-current={g.name === genre}
                  onClick={() => setGenre(g.name)}
                  className={CHIP_CLS}
                >
                  {g.name}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {empty ? (
        <div className="flex flex-1 items-center justify-center px-16">
          <p className="max-w-160 text-center font-sans text-[18px] font-medium text-dim">
            {t('content.myListEmpty')}
          </p>
        </div>
      ) : (
        <PosterGrid cards={cards} />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-7.5 bg-[linear-gradient(0deg,rgba(10,10,12,0.85),transparent)] p-4 font-sans text-[13px] font-semibold text-dim">
        <span>{t('content.hintBrowseAll')}</span>
        <span>{t('content.hintRows')}</span>
        <span>
          <b className="font-bold text-accent">{t('content.hintOk')}</b> {t('content.hintOpen')}
        </span>
      </div>
    </div>
  );
}
