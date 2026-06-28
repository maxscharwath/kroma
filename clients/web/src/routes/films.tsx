import { createFileRoute } from '@tanstack/react-router';
import { lumaClient, toMovieView } from '#web/lib/api';
import { MovieGrid } from '#web/components/cards';

export const Route = createFileRoute('/films')({
  loader: async () => {
    const c = lumaClient();
    const movies = await c.movies();
    return { movies: movies.map((m) => toMovieView(c, m)) };
  },
  component: FilmsPage,
});

function FilmsPage() {
  const { movies } = Route.useLoaderData();
  return (
    <main className="max-w-[1600px] px-[var(--gutter-web)] pb-16 pt-10">
      <h2 className="mb-6 mt-2 font-display text-[28px] font-bold tracking-[-.02em]">Films</h2>
      <MovieGrid movies={movies} />
    </main>
  );
}
