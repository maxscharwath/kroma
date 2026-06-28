import { createFileRoute } from '@tanstack/react-router';
import { lumaClient, toMovieView, toShowView } from '#web/lib/api';
import { Hero, MovieRail, ShowRail } from '#web/components/cards';
import { ContinueRow } from '#web/components/ContinueRow';

export const Route = createFileRoute('/')({
  loader: async () => {
    const c = lumaClient();
    const [movies, shows] = await Promise.all([c.movies(), c.shows()]);
    return {
      movies: movies.map((m) => toMovieView(c, m)),
      shows: shows.map((s) => toShowView(c, s)),
    };
  },
  component: HomePage,
});

function HomePage() {
  const { movies, shows } = Route.useLoaderData();
  const hdr = movies.filter((m) => m.video?.hdr);
  return (
    <main className="max-w-[1600px] px-[var(--gutter-web)] pb-16 pt-10">
      {movies[0] ? <Hero movie={movies[0]} /> : null}
      <ContinueRow />
      {hdr.length >= 3 ? <MovieRail title="En 4K · HDR" movies={hdr} /> : null}
      <MovieRail title="Films" movies={movies} />
      <ShowRail title="Séries" shows={shows} />
    </main>
  );
}
