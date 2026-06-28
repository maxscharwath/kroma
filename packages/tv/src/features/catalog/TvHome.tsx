import {
  formatRuntime,
  type MediaItem,
  posterColors,
  qualityBadge,
  qualityBadgeForVideo,
  type Show,
} from '@luma/core';
import { useT } from '@luma/ui';
import { useCallback, useEffect, useMemo } from 'react';
import { useConnection } from '#tv/connection';
import { useContinue } from '#tv/continue';
import { TvTopNav } from '#tv/home/TopNav';
import { useClient, useNav } from '#tv/router';
import { badgeClasses, PlayGlyph, TvArt, TvCard } from '#tv/TvMedia';
import { useFocusNav } from '#tv/useFocusNav';

const RAIL_LIMIT = 20;
const HERO_VEIL =
  'absolute inset-0 bg-[linear-gradient(90deg,#0A0A0C_5%,transparent_60%),linear-gradient(0deg,#0A0A0C_1%,transparent_48%)]';

interface Row {
  key: string;
  title: string;
  cards: React.ReactNode[];
}

/** The 10-foot home — a cinematic hero over a vertical stack of horizontal rails
 * (Reprendre / Films / Séries previews). Films, Séries and Search live on their
 * own screens via the shared top nav. */
export function TvHome() {
  const { movies, shows } = useConnection();
  const { items: continueItems, refresh: refreshContinue } = useContinue();
  const { go } = useNav();
  const client = useClient();
  const t = useT();
  useEffect(() => refreshContinue(), [refreshContinue]);
  useFocusNav({});

  const onSelectMovie = useCallback((m: MediaItem) => go('movie', { item: m }), [go]);
  const onSelectShow = useCallback((s: Show) => go('show', { show: s }), [go]);
  const onPlay = useCallback((m: MediaItem) => go('player', { item: m }), [go]);

  const hero = movies[0] ?? null;

  const rows = useMemo<Row[]>(() => {
    const continueRow: Row | null = continueItems.length
      ? {
          key: 'continue',
          title: t('content.continueWatching'),
          cards: continueItems.map(({ item, positionMs, durationMs }) => {
            const dur = durationMs ?? item.durationMs ?? 0;
            const pct = dur > 0 ? Math.min(100, Math.round((positionMs / dur) * 100)) : 0;
            const genre =
              item.kind === 'episode' && item.showTitle
                ? `${item.showTitle} · S${item.season}E${item.episode}`
                : t('content.film');
            return (
              <TvCard
                key={`continue-${item.id}`}
                title={item.title}
                genre={genre}
                badge={qualityBadge(item)}
                backdrop={client.backdropFor(item) ?? client.posterFor(item)}
                colors={posterColors(item.id)}
                progress={pct}
                width={330}
                onClick={() => onPlay(item)}
              />
            );
          }),
        }
      : null;
    const movieRow: Row | null = movies.length
      ? {
          key: 'films',
          title: t('nav.films'),
          cards: movies
            .slice(0, RAIL_LIMIT)
            .map((m) => (
              <TvCard
                key={m.id}
                title={m.title}
                genre={m.metadata?.genres?.[0] ?? t('content.film')}
                badge={qualityBadge(m)}
                backdrop={client.backdropFor(m) ?? client.posterFor(m)}
                colors={posterColors(m.id)}
                width={330}
                onClick={() => onSelectMovie(m)}
              />
            )),
        }
      : null;
    const showRow: Row | null = shows.length
      ? {
          key: 'series',
          title: t('nav.series'),
          cards: shows
            .slice(0, RAIL_LIMIT)
            .map((s) => (
              <TvCard
                key={s.id}
                title={s.title}
                genre={
                  s.metadata?.genres?.[0] ?? t('content.seasonCount', { count: s.seasonCount })
                }
                badge={qualityBadgeForVideo(s.video)}
                backdrop={client.backdropFor(s) ?? client.showPosterFor(s)}
                colors={posterColors(s.id)}
                width={330}
                onClick={() => onSelectShow(s)}
              />
            )),
        }
      : null;
    return [continueRow, movieRow, showRow].filter((r): r is Row => r !== null);
  }, [movies, shows, continueItems, client, onPlay, onSelectMovie, onSelectShow, t]);

  const heroBackdrop = hero ? (client.backdropFor(hero) ?? client.posterFor(hero)) : null;
  const heroBadge = hero ? qualityBadge(hero) : null;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg">
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto pb-10">
        {hero ? (
          <section className="relative h-[64vh] min-h-[520px]">
            <TvArt src={heroBackdrop} colors={posterColors(hero.id)} position="50% 22%" />
            <div className={HERO_VEIL} />
            <div className="absolute bottom-9 left-16 z-2 max-w-205">
              <div className="mb-4 font-sans text-[14px] font-bold uppercase tracking-[0.24em] text-accent">
                {t('content.featured')}
              </div>
              <h1 className="m-0 mb-3.5 font-display text-[clamp(42px,7.6vh,82px)] font-bold leading-[0.96] tracking-[-0.02em]">
                {hero.title}
              </h1>
              <div className="mb-3.5 flex flex-wrap items-center gap-3 font-sans text-[17px] font-semibold text-muted">
                {hero.metadata?.rating ? (
                  <>
                    <span className="font-bold text-accent">
                      {hero.metadata.rating.toFixed(1)}★
                    </span>
                    <span className="text-dim">·</span>
                  </>
                ) : null}
                <span>{heroMeta(hero)}</span>
                {heroBadge ? <span className={badgeClasses(heroBadge)}>{heroBadge}</span> : null}
              </div>
              {hero.metadata?.overview ? (
                <p className="m-0 mb-5.5 max-w-180 font-sans text-[clamp(15px,2.3vh,20px)] leading-[1.5] text-[rgba(244,243,240,0.82)] line-clamp-3">
                  {hero.metadata.overview}
                </p>
              ) : null}
              <div className="flex gap-4.5">
                <button
                  className="inline-flex cursor-pointer items-center gap-3 rounded-[13px] bg-accent px-10 py-4.5 font-sans text-[20px] font-bold text-accent-ink transition-transform focus:scale-[1.04]"
                  data-focus=""
                  onClick={() => onPlay(hero)}
                >
                  <PlayGlyph />
                  {t('player.play')}
                </button>
                <button
                  className="inline-flex cursor-pointer items-center gap-3 rounded-[13px] border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.12)] px-8.5 py-4.5 font-sans text-[20px] font-semibold text-text transition-transform focus:scale-[1.04]"
                  data-focus=""
                  onClick={() => onSelectMovie(hero)}
                >
                  {t('content.moreInfo')}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className="h-[40vh]" />
        )}

        {rows.map((row) => (
          <div key={row.key} className="mb-2">
            <h2 className="mt-4.5 mb-4 px-16 font-display text-[28px] font-bold tracking-[-0.02em]">
              {row.title}
            </h2>
            <div className="scrollbar-none flex gap-6 overflow-x-auto px-16 py-8">{row.cards}</div>
          </div>
        ))}
      </div>

      <TvTopNav active="home" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-7.5 bg-[linear-gradient(0deg,rgba(10,10,12,0.8),transparent)] p-4 font-sans text-[13px] font-semibold text-dim">
        <span>{t('content.hintBrowse')}</span>
        <span>{t('content.hintRows')}</span>
        <span>
          <b className="font-bold text-accent">{t('content.hintOk')}</b> {t('content.hintOpen')}
        </span>
      </div>
    </div>
  );
}

/** Hero meta line — year · runtime · genre (quality lives in the badge). */
function heroMeta(item: MediaItem): string {
  return [
    item.year ? String(item.year) : null,
    formatRuntime(item.durationMs),
    item.metadata?.genres?.[0],
  ]
    .filter(Boolean)
    .join(' · ');
}
