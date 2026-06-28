import { useEffect, useMemo, useState } from 'react';
import { formatRuntime, posterColors, qualityBadgeForVideo, type ShowDetail } from '@luma/core';
import { TvDetailScaffold } from '#tv/detail/DetailScaffold';
import { useClient, useNav, useParams } from '#tv/router';
import { PlayGlyph, TV_PLAY_BTN, TvArt } from '#tv/TvMedia';
import { useFocusNav } from '#tv/useFocusNav';

export function TvShowDetail() {
  const nav = useNav();
  const { show } = useParams('show');
  const client = useClient();
  const [detail, setDetail] = useState<ShowDetail | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusNav({ onBack: nav.back, resetKey: detail });

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setSeason(null);
    setError(null);
    client
      .show(show.id)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setSeason(d.seasons[0]?.number ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [client, show.id]);

  const meta = show.metadata;
  const backdrop = client.backdropFor(show) ?? client.showPosterFor(show);

  const activeSeason = useMemo(
    () => detail?.seasons.find((s) => s.number === season) ?? detail?.seasons[0] ?? null,
    [detail, season],
  );
  const firstEpisode = activeSeason?.episodes[0] ?? null;

  const metaLong = [
    show.year ? String(show.year) : null,
    `${show.seasonCount} saison${show.seasonCount > 1 ? 's' : ''}`,
    `${show.episodeCount} épisode${show.episodeCount > 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TvDetailScaffold
      id={show.id}
      kind="Série"
      title={show.title}
      backdrop={backdrop}
      rating={meta?.rating}
      meta={metaLong}
      badge={qualityBadgeForVideo(show.video)}
      overview={meta?.overview}
    >
      <div className="flex items-center gap-4">
        <button
          className={TV_PLAY_BTN}
          data-focus=""
          disabled={!firstEpisode}
          onClick={() => firstEpisode && nav.go('player', { item: firstEpisode })}
        >
          <PlayGlyph />
          {firstEpisode ? `Lecture S${firstEpisode.season}E${firstEpisode.episode}` : 'Lecture'}
        </button>
      </div>

      {error ? <p className="mt-6 font-display text-[20px] font-normal text-muted">Impossible de charger les épisodes. {error}</p> : null}
      {!detail && !error ? <p className="mt-6 font-display text-[20px] font-normal text-muted">Chargement des épisodes…</p> : null}

      {detail && detail.seasons.length > 1 ? (
        <div className="mt-[30px] flex items-center gap-[18px]">
          <span className="font-sans text-[15px] font-bold tracking-[0.04em] text-muted">SAISONS</span>
          <div className="scrollbar-none flex gap-2.5 overflow-x-auto px-2 py-1.5">
            {detail.seasons.map((s) => (
              <button
                key={s.number}
                className="shrink-0 cursor-pointer rounded-full border-none bg-surface-2 px-5 py-[9px] font-sans text-[15px] font-semibold text-muted transition-transform focus:scale-[1.05] aria-[current=true]:bg-accent aria-[current=true]:text-accent-ink"
                data-focus=""
                aria-current={s.number === activeSeason?.number}
                onClick={() => setSeason(s.number)}
              >
                Saison {s.number}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {activeSeason ? (
        <div className="mt-8">
          <div className="mb-4 font-sans text-[15px] font-bold tracking-[0.04em] text-muted">ÉPISODES</div>
          <div className="scrollbar-none flex gap-[18px] overflow-x-auto px-1.5 py-[18px]">
            {activeSeason.episodes.map((ep) => (
              <button
                key={ep.id}
                className="w-[260px] shrink-0 cursor-pointer border-none bg-transparent p-0 text-left transition-transform focus:scale-[1.05]"
                data-focus=""
                onClick={() => nav.go('player', { item: ep })}
              >
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[12px] bg-surface-1">
                  <TvArt src={client.backdropFor(ep) ?? backdrop} colors={posterColors(ep.id)} position="50% 30%" />
                  <div className="relative flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[rgba(10,10,12,0.5)] text-white">
                    <PlayGlyph size={18} />
                  </div>
                </div>
                <div className="mt-[9px] font-sans text-[15px] font-semibold text-text">
                  {ep.episode}. {ep.episodeTitle ?? ep.title}
                </div>
                <div className="font-sans text-[13px] font-medium text-dim tabular-nums">{formatRuntime(ep.durationMs)}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </TvDetailScaffold>
  );
}
