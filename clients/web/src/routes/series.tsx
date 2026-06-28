import { createFileRoute } from '@tanstack/react-router';
import { lumaClient, toShowView } from '#web/lib/api';
import { ShowGrid } from '#web/components/cards';

export const Route = createFileRoute('/series')({
  loader: async () => {
    const c = lumaClient();
    const shows = await c.shows();
    return { shows: shows.map((s) => toShowView(c, s)) };
  },
  component: SeriesPage,
});

function SeriesPage() {
  const { shows } = Route.useLoaderData();
  return (
    <main className="max-w-[1600px] px-[var(--gutter-web)] pb-16 pt-10">
      <h2 className="mb-6 mt-2 font-display text-[28px] font-bold tracking-[-.02em]">Séries</h2>
      <ShowGrid shows={shows} />
    </main>
  );
}
