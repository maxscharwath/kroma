import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatRuntime, type MediaItem, posterColors, qualityBadge, qualityBadgeForVideo, type Show } from '@luma/core';
import { Logo } from '@luma/ui';
import { useConnection } from '#tv/connection';
import { useContinue } from '#tv/continue';
import { ActivityPill } from '#tv/home/ActivityPill';
import { ProfileChip } from '#tv/home/ProfileChip';
import { type GridCard, TvGrid } from '#tv/home/TvGrid';
import { useClient, useNav } from '#tv/router';
import { badgeClasses, PlayGlyph, TvArt, TvCard, TV_PLAY_BTN } from '#tv/TvMedia';
import { useFocusNav } from '#tv/useFocusNav';

const NAV = ['Accueil', 'Films', 'Séries'] as const;
type Tab = (typeof NAV)[number];

// Home rails are previews, not the whole library — browse the full set in the grid.
const RAIL_LIMIT = 20;

const HERO_VEIL =
  'absolute inset-0 bg-[linear-gradient(90deg,#0A0A0C_4%,transparent_60%),linear-gradient(0deg,#0A0A0C_1%,transparent_48%)]';

interface Row {
  key: string;
  title: string;
  cards: React.ReactNode[];
}

export function TvHome() {
  const { movies, shows, activity } = useConnection();
  const { items: continueItems, refresh: refreshContinue } = useContinue();
  const { go } = useNav();
  const client = useClient();
  // Re-fetch "Reprendre" each time we land on home (e.g. after the player closes).
  useEffect(() => refreshContinue(), [refreshContinue]);
  // Navigation via the router (props-free): same names so call sites stay unchanged.
  const onSelectMovie = useCallback((m: MediaItem) => go('movie', { item: m }), [go]);
  const onSelectShow = useCallback((s: Show) => go('show', { show: s }), [go]);
  const onPlayMovie = useCallback((m: MediaItem) => go('player', { item: m }), [go]);
  const onResume = useCallback((m: MediaItem) => go('player', { item: m }), [go]);
  const [tab, setTab] = useState<Tab>('Accueil');
  // Back returns to Accueil from a browse grid (and is a no-op on Accueil itself).
  const onBack = useCallback(() => setTab((t) => (t === 'Accueil' ? t : 'Accueil')), []);
  useFocusNav({ resetKey: tab, onBack });

  const browsing = tab !== 'Accueil';
  const hero = movies[0] ?? null;

  // Accueil rails: capped previews (full library lives in the grid).
  const rows = useMemo<Row[]>(() => {
    if (browsing) return [];
    // "Reprendre" comes first when there are resumable items.
    const continueRow: Row | null = continueItems.length
      ? {
          key: 'continue',
          title: 'Reprendre',
          cards: continueItems.map(({ item, positionMs, durationMs }) => {
            const dur = durationMs ?? item.durationMs ?? 0;
            const pct = dur > 0 ? Math.min(100, Math.round((positionMs / dur) * 100)) : 0;
            const genre =
              item.kind === 'episode' && item.showTitle
                ? `${item.showTitle} · S${item.season}E${item.episode}`
                : 'Film';
            return (
              <TvCard
                key={`continue-${item.id}`}
                title={item.title}
                genre={genre}
                badge={qualityBadge(item)}
                backdrop={client.backdropFor(item) ?? client.posterFor(item)}
                colors={posterColors(item.id)}
                progress={pct}
                onClick={() => onResume(item)}
              />
            );
          }),
        }
      : null;
    const movieRow: Row | null = movies.length
      ? {
          key: 'films',
          title: 'Films',
          cards: movies.slice(0, RAIL_LIMIT).map((m) => (
            <TvCard
              key={m.id}
              title={m.title}
              genre={m.metadata?.genres?.[0] ?? 'Film'}
              badge={qualityBadge(m)}
              backdrop={client.backdropFor(m) ?? client.posterFor(m)}
              colors={posterColors(m.id)}
              onClick={() => onSelectMovie(m)}
            />
          )),
        }
      : null;
    const showRow: Row | null = shows.length
      ? {
          key: 'series',
          title: 'Séries',
          cards: shows.slice(0, RAIL_LIMIT).map((s) => (
            <TvCard
              key={s.id}
              title={s.title}
              genre={s.metadata?.genres?.[0] ?? `${s.seasonCount} saison${s.seasonCount > 1 ? 's' : ''}`}
              badge={qualityBadgeForVideo(s.video)}
              backdrop={client.backdropFor(s) ?? client.showPosterFor(s)}
              colors={posterColors(s.id)}
              onClick={() => onSelectShow(s)}
            />
          )),
        }
      : null;
    return [continueRow, movieRow, showRow].filter((r): r is Row => r !== null);
  }, [browsing, movies, shows, continueItems, client, onResume, onSelectMovie, onSelectShow]);

  // Browse grid: lightweight data objects (TvGrid creates the elements as it grows).
  const gridCards = useMemo<GridCard[]>(() => {
    if (tab === 'Films') {
      return movies.map((m) => ({
        id: m.id,
        title: m.title,
        badge: qualityBadge(m),
        poster: client.posterFor(m),
        colors: posterColors(m.id),
        onClick: () => onSelectMovie(m),
      }));
    }
    if (tab === 'Séries') {
      return shows.map((s) => ({
        id: s.id,
        title: s.title,
        badge: qualityBadgeForVideo(s.video),
        poster: client.showPosterFor(s),
        colors: posterColors(s.id),
        onClick: () => onSelectShow(s),
      }));
    }
    return [];
  }, [tab, movies, shows, client, onSelectMovie, onSelectShow]);

  const navPill = (
    <nav className="absolute left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-[rgba(10,10,12,0.42)] p-[5px] backdrop-blur-[10px]">
      {NAV.map((label) => (
        <div
          key={label}
          className="cursor-pointer rounded-full px-5 py-[9px] font-sans text-[15px] font-semibold text-muted transition-transform focus:scale-[1.04] aria-[current=true]:bg-accent aria-[current=true]:text-accent-ink"
          data-focus=""
          tabIndex={0}
          role="button"
          aria-current={label === tab}
          onClick={() => setTab(label)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setTab(label);
          }}
        >
          {label}
        </div>
      ))}
    </nav>
  );

  const heroBackdrop = hero ? client.backdropFor(hero) ?? client.posterFor(hero) : null;
  const heroBadge = hero ? qualityBadge(hero) : null;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg">
      {!browsing && hero ? (
        <section className="relative flex-[0_0_56%] min-h-0">
          <TvArt src={heroBackdrop} colors={posterColors(hero.id)} position="50% 22%" />
          <div className={HERO_VEIL} />
          <header className="absolute inset-x-0 top-0 z-[5] flex items-center px-16 py-[34px]">
            <Logo size={30} />
            {navPill}
            <div className="ml-auto flex items-center gap-3">
              <ActivityPill activity={activity} />
              <ProfileChip />
            </div>
          </header>
          <div className="absolute bottom-9 left-16 z-[2] max-w-[820px]">
            <div className="mb-3.5 font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-accent">★ En vedette</div>
            <h1 className="m-0 mb-[14px] font-display text-[clamp(42px,7.4vh,80px)] font-bold leading-[0.96] tracking-[-0.02em]">
              {hero.title}
            </h1>
            <div className="mb-3.5 flex flex-wrap items-center gap-3 font-sans text-[15px] font-semibold text-muted">
              {hero.metadata?.rating ? (
                <>
                  <span className="font-bold text-accent">{hero.metadata.rating.toFixed(1)}★</span>
                  <span className="text-dim">·</span>
                </>
              ) : null}
              <span>{heroMeta(hero)}</span>
              {heroBadge ? <span className={badgeClasses(heroBadge)}>{heroBadge}</span> : null}
            </div>
            {hero.metadata?.overview ? (
              <p className="m-0 mb-[22px] max-w-[720px] font-sans text-[clamp(15px,2.1vh,19px)] leading-[1.5] text-[rgba(244,243,240,0.82)] line-clamp-3">
                {hero.metadata.overview}
              </p>
            ) : null}
            <div className="flex gap-4">
              <button className={TV_PLAY_BTN} data-focus="" onClick={() => onPlayMovie(hero)}>
                <PlayGlyph />
                Lecture
              </button>
              <button
                className="inline-flex items-center gap-[11px] cursor-pointer rounded-[13px] border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.12)] px-9 py-4 font-sans text-[19px] font-bold text-text transition-transform focus:scale-[1.04]"
                data-focus=""
                onClick={() => onSelectMovie(hero)}
              >
                Plus d'infos
              </button>
            </div>
          </div>
        </section>
      ) : (
        <header className="relative z-[5] flex shrink-0 items-center border-b border-border px-16 py-6">
          <Logo size={30} />
          {navPill}
          <div className="ml-auto flex items-center gap-3">
            <ActivityPill activity={activity} />
            <ProfileChip />
          </div>
        </header>
      )}

      {browsing ? (
        <TvGrid label={tab} cards={gridCards} />
      ) : (
        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto pt-1 pb-[30px]">
          {rows.map((row) => (
            <div key={row.key} className="mb-1">
              <h2 className="mt-4 mb-1 px-16 font-display text-[28px] font-bold tracking-[-0.02em]">{row.title}</h2>
              <div className="scrollbar-none flex gap-6 overflow-x-auto px-16 py-7">{row.cards}</div>
            </div>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-[30px] bg-[linear-gradient(0deg,rgba(10,10,12,0.85),transparent)] p-3.5 font-sans text-[13px] font-semibold text-dim">
        {browsing ? (
          <>
            <span>◀ ▶ ▲ ▼ Parcourir</span>
            <span>
              <b className="font-bold text-accent">OK</b> Ouvrir
            </span>
            <span>
              <b className="font-bold text-accent">Retour</b> Accueil
            </span>
          </>
        ) : (
          <>
            <span>◀ ▶ Parcourir</span>
            <span>▲ ▼ Changer de ligne</span>
            <span>
              <b className="font-bold text-accent">OK</b> Lecture
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** Hero meta line — year · runtime · genre (quality lives in the badge). */
function heroMeta(item: MediaItem): string {
  return [item.year ? String(item.year) : null, formatRuntime(item.durationMs), item.metadata?.genres?.[0]]
    .filter(Boolean)
    .join(' · ');
}


