import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { formatRuntime, posterColors, qualityBadgeForVideo, type MediaItem, type Season } from '@luma/core';
import {
  CastRail,
  DetailHero,
  SimilarRail,
  audioString,
  qualityBadges,
  subString,
  type SimilarItem,
} from '#web/components/detail';
import { lumaClient } from '#web/lib/api';

export const Route = createFileRoute('/show/$id')({
  loader: async ({ params }) => {
    const c = lumaClient();
    const [detail, shows] = await Promise.all([c.show(params.id), c.shows()]);
    const show = detail.show;
    const genres = new Set(show.metadata?.genres ?? []);
    const others = shows.filter((s) => s.id !== show.id);
    const related = others.filter((s) => (s.metadata?.genres ?? []).some((g) => genres.has(g)));
    const pool = (related.length >= 3 ? related : others).slice(0, 12);
    const similar: SimilarItem[] = pool.map((s) => ({
      id: s.id,
      title: s.title,
      genre: `${s.seasonCount} saison${s.seasonCount > 1 ? 's' : ''}`,
      badge: qualityBadgeForVideo(s.video),
      poster: c.showPosterFor(s),
    }));
    return {
      detail,
      poster: c.showPosterFor(show),
      backdrop: c.backdropFor(show),
      similar,
    };
  },
  component: ShowDetailPage,
});

function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

function PlayGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M7 4v16l13-8z" />
    </svg>
  );
}

function EpisodeRow({ episode, onPlay }: Readonly<{ episode: MediaItem; onPlay: () => void }>) {
  const [g1, g2] = posterColors(episode.id);
  const runtime = formatRuntime(episode.durationMs);
  const synopsis = episode.metadata?.overview;
  return (
    <button
      type="button"
      onClick={onPlay}
      className="flex items-center gap-5 rounded-[14px] border border-white/[.05] bg-white/[.025] p-3.5 text-left
        transition-colors hover:bg-white/[.06]"
    >
      <div
        className="relative flex aspect-video w-[200px] shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
        style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(170deg,rgba(0,0,0,.05),rgba(0,0,0,.45))]" />
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(10,10,12,.5)] backdrop-blur-[4px]">
          <PlayGlyph />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className="text-[17px] font-bold">
            {episode.episode}. {episode.episodeTitle ?? episode.title}
          </span>
          {runtime ? <span className="text-[13px] font-medium text-white/45">{runtime}</span> : null}
        </div>
        {synopsis ? <p className="line-clamp-2 text-[14px] leading-[1.5] text-white/60">{synopsis}</p> : null}
      </div>
    </button>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SeasonSwitcher({
  seasons,
  current,
  onPick,
}: Readonly<{ seasons: Season[]; current: number; onPick: (n: number) => void }>) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex items-center gap-2.5 rounded-md border border-border-strong bg-white/[.07] px-[18px] py-2.5
          text-[15px] font-semibold text-text outline-none transition-colors hover:bg-white/[.12]"
      >
        Saison {current}
        <Chevron />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 min-w-[240px] rounded-xl border border-border bg-[rgba(24,24,28,.97)] p-1.5 shadow-pop
            backdrop-blur-[20px] data-[state=open]:animate-[pop-in_.16s_var(--ease-out)]"
        >
          {seasons.map((s) => {
            const active = s.number === current;
            return (
              <DropdownMenu.Item
                key={s.number}
                onSelect={() => onPick(s.number)}
                className="flex cursor-pointer items-center justify-between gap-3.5 rounded-[9px] px-3.5 py-2.5
                  outline-none data-[highlighted]:bg-white/[.07]"
              >
                <div>
                  <div className={`text-[15px] font-semibold ${active ? 'text-accent' : 'text-text'}`}>
                    Saison {s.number}
                  </div>
                  <div className="text-[12px] font-medium text-white/40">{plural(s.episodes.length, 'épisode')}</div>
                </div>
                {active ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-accent" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ShowDetailPage() {
  const { detail, poster, backdrop, similar } = Route.useLoaderData();
  const navigate = useNavigate();
  const show = detail.show;
  const seasons = detail.seasons;
  const meta = show.metadata;

  const [season, setSeason] = useState(seasons[0]?.number ?? 1);
  const current = seasons.find((s) => s.number === season) ?? seasons[0];
  const firstEpisode = seasons[0]?.episodes[0] ?? null;

  const play = (id: string) => navigate({ to: '/watch/$id', params: { id } });

  const metaParts = [
    show.year ? String(show.year) : null,
    plural(show.seasonCount, 'saison'),
    plural(show.episodeCount, 'épisode'),
  ].filter(Boolean);

  return (
    <main className="animate-[fade-in_.4s_ease] pb-16">
      <DetailHero
        art={{ id: show.id, backdrop, poster }}
        overline={`Série · ${plural(show.seasonCount, 'saison')}`}
        title={show.title}
        rating={meta?.rating}
        meta={metaParts.join(' · ')}
        badges={qualityBadges(show.video)}
        tagline={meta?.tagline}
        overview={meta?.overview}
        audio={firstEpisode ? audioString(firstEpisode) : '—'}
        subtitles={firstEpisode ? subString(firstEpisode) : 'Aucun'}
        playable={firstEpisode}
        onBack={() => navigate({ to: '/series' })}
        onPlay={() => firstEpisode && play(firstEpisode.id)}
      />

      <CastRail cast={meta?.cast ?? []} />

      {current ? (
        <section className="mt-10">
          <div className="mb-2 flex flex-wrap items-center gap-3.5 px-[var(--gutter-web)]">
            <h2 className="font-display text-[24px] font-bold tracking-[-.02em]">Épisodes</h2>
            {seasons.length > 1 ? (
              <SeasonSwitcher seasons={seasons} current={current.number} onPick={setSeason} />
            ) : null}
          </div>
          <div className="mb-5 px-[var(--gutter-web)] text-[14px] font-medium text-white/45">
            {plural(current.episodes.length, 'épisode')}
          </div>
          <div className="flex max-w-[1000px] flex-col gap-3.5 px-[var(--gutter-web)]">
            {current.episodes.map((ep) => (
              <EpisodeRow key={ep.id} episode={ep} onPlay={() => play(ep.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <SimilarRail
        title="Séries similaires"
        items={similar}
        onOpen={(id) => navigate({ to: '/show/$id', params: { id } })}
      />
    </main>
  );
}
