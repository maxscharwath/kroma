import { useNavigate } from '@tanstack/react-router';
import { metaLine, posterColors, qualityBadge, qualityBadgeForVideo } from '@luma/core';
import { Badge, Button, Poster, Rail } from '#web/components/ui';
import type { MovieView, ShowView } from '#web/lib/api';

type HeroBadge = '4K' | 'HDR' | 'H.265';

function heroBadges(movie: MovieView): HeroBadge[] {
  const v = movie.video;
  if (!v) return [];
  const out: HeroBadge[] = [];
  if ((v.width ?? 0) >= 3840) out.push('4K');
  if (v.hdr) out.push('HDR');
  if (v.codec === 'hevc') out.push('H.265');
  return out;
}

const SECTION_TITLE = 'mb-5 mt-10 font-display text-[22px] font-bold tracking-[-.02em] text-text';

/** Full-bleed featured banner — TMDB backdrop as cinematic art, bled to the
 * content edges (cancels the page gutter) and faded into the rails below. */
export function Hero({ movie }: { movie: MovieView }) {
  const navigate = useNavigate();
  const colors = posterColors(movie.id);
  const bg = movie.backdrop
    ? `url("${movie.backdrop}")`
    : `linear-gradient(158deg, ${colors[0]}, ${colors[1]})`;
  const meta = movie.metadata;
  const badges = heroBadges(movie);

  return (
    <div
      className="relative -mx-[var(--gutter-web)] -mt-10 mb-8 flex min-h-[460px] flex-col justify-end overflow-hidden px-[var(--gutter-web)] pb-10 pt-16"
      style={{ backgroundImage: bg, backgroundSize: 'cover', backgroundPosition: 'center 18%' }}
    >
      <div className="pointer-events-none absolute inset-0 animate-[luma-breathe_7s_var(--ease-out)_infinite] bg-[radial-gradient(58%_68%_at_72%_32%,rgba(242,180,66,.16),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--luma-bg)_6%,rgba(10,10,12,.35)_42%,transparent_64%),linear-gradient(0deg,var(--luma-bg)_2%,transparent_46%)]" />

      <div className="relative max-w-[680px]">
        <div className="mb-3.5 inline-flex items-center gap-[7px] text-[12px] font-bold uppercase tracking-[.22em] text-accent">
          ★ En vedette
        </div>
        <h1 className="mb-3.5 font-display text-[66px] font-bold leading-[.98] tracking-[-.02em]">
          {movie.title}
        </h1>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-[13px] font-medium text-muted">
          {meta?.rating ? <span className="font-semibold text-accent">{meta.rating.toFixed(1)}★</span> : null}
          <span>{metaLine(movie)}</span>
          {badges.map((b) => (
            <Badge key={b} tone={b}>
              {b}
            </Badge>
          ))}
        </div>
        {meta?.overview ? (
          <p className="mb-5 line-clamp-3 max-w-[540px] text-[16px] leading-[1.55] text-text">{meta.overview}</p>
        ) : null}
        <div className="flex gap-3.5">
          <Button onClick={() => navigate({ to: '/watch/$id', params: { id: movie.id } })}>Lecture</Button>
          <Button variant="glass" onClick={() => navigate({ to: '/movie/$id', params: { id: movie.id } })}>
            Plus d’infos
          </Button>
        </div>
      </div>
    </div>
  );
}

function MoviePoster({ item }: { item: MovieView }) {
  const navigate = useNavigate();
  return (
    <Poster
      title={item.title}
      genre="Film"
      badge={qualityBadge(item)}
      colors={posterColors(item.id)}
      poster={item.poster}
      onClick={() => navigate({ to: '/movie/$id', params: { id: item.id } })}
    />
  );
}

function ShowPoster({ show }: { show: ShowView }) {
  const navigate = useNavigate();
  return (
    <Poster
      title={show.title}
      genre={`${show.seasonCount} saison${show.seasonCount > 1 ? 's' : ''}`}
      badge={qualityBadgeForVideo(show.video)}
      colors={posterColors(show.id)}
      poster={show.poster}
      onClick={() => navigate({ to: '/show/$id', params: { id: show.id } })}
    />
  );
}

export function MovieRail({ title, movies }: { title: string; movies: MovieView[] }) {
  if (movies.length === 0) return null;
  return (
    <section>
      <h2 className={SECTION_TITLE}>{title}</h2>
      <Rail label={title}>
        {movies.map((item) => (
          <MoviePoster key={item.id} item={item} />
        ))}
      </Rail>
    </section>
  );
}

export function ShowRail({ title, shows }: { title: string; shows: ShowView[] }) {
  if (shows.length === 0) return null;
  return (
    <section>
      <h2 className={SECTION_TITLE}>{title}</h2>
      <Rail label={title}>
        {shows.map((show) => (
          <ShowPoster key={show.id} show={show} />
        ))}
      </Rail>
    </section>
  );
}

const GRID = 'flex flex-wrap gap-x-[18px] gap-y-6';

export function MovieGrid({ movies }: { movies: MovieView[] }) {
  return (
    <div className={GRID}>
      {movies.map((item) => (
        <MoviePoster key={item.id} item={item} />
      ))}
    </div>
  );
}

export function ShowGrid({ shows }: { shows: ShowView[] }) {
  return (
    <div className={GRID}>
      {shows.map((show) => (
        <ShowPoster key={show.id} show={show} />
      ))}
    </div>
  );
}
