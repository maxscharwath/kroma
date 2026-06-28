import { useMemo } from 'react';
import { audioSupport, metaLine } from '@luma/core';
import { useClient, useNav, useParams } from '#tv/router';
import { TvSubtitles } from '#tv/TvSubtitles';
import { AvPanel } from '#tv/player/AvPanel';
import { fmtTime } from '#tv/player/fmt';
import { BackChevron, ForwardGlyph, PauseGlyph, PlayGlyph, RewindGlyph, TracksGlyph } from '#tv/player/icons';
import { useDirectPlayback } from '#tv/player/useDirectPlayback';
import { usePlayerControls } from '#tv/player/usePlayerControls';
import { useSubtitleSelection } from '#tv/player/useSubtitleSelection';

const FOCUS_RING = 'scale-[1.07] shadow-[var(--ring-focus),var(--glow-accent)]';
const CTRL = 'flex items-center justify-center rounded-full text-white transition-[transform,box-shadow,background] duration-[180ms]';

/**
 * Fullscreen 10-foot direct-play surface. Composes three concerns: playback
 * (useDirectPlayback), subtitle tracks (useSubtitleSelection) and the remote-driven
 * control overlay (usePlayerControls). The body here is just the render.
 */
export function TvPlayer() {
  const nav = useNav();
  const { item } = useParams('player');
  const client = useClient();

  const playback = useDirectPlayback(client, item);
  const subs = useSubtitleSelection(client, item);
  const { controls, zone, avOpen, avFocus, barFocus } = usePlayerControls({
    playing: playback.playing,
    togglePlay: playback.togglePlay,
    seek: playback.seek,
    onExit: nav.back,
    subOptions: subs.options,
    activeSub: subs.active,
    pickSub: subs.pick,
  });

  const audio = useMemo(() => audioSupport(item), [item]);
  const subtitle =
    item.kind === 'episode' && item.showTitle ? `${item.showTitle} · S${item.season}E${item.episode}` : metaLine(item);

  const { cur, dur, bufEnd, playing, waiting, error, verdict } = playback;
  const pct = dur ? (cur / dur) * 100 : 0;
  const bufPct = dur ? (bufEnd / dur) * 100 : 0;
  const fade = controls ? 'opacity-100' : 'pointer-events-none opacity-0';
  const warn = error ?? (verdict && !verdict.canDirectPlay ? verdict.reason : audio.canPlay ? null : audio.reason);

  return (
    <div className={`fixed inset-0 z-[60] bg-black ${controls ? '' : 'cursor-none'}`}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={playback.videoRef} className="h-full w-full bg-black object-contain" autoPlay playsInline />
      <TvSubtitles videoRef={playback.videoRef} rendered={subs.rendered} activeIndex={subs.active} raised={controls} />

      {waiting && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full border-[3px] border-[rgba(255,255,255,0.2)] border-t-accent [animation:tvp-spin_0.9s_linear_infinite]" />
        </div>
      ) : null}

      {/* top bar */}
      <div
        className={`absolute inset-x-0 top-0 flex items-center gap-[18px] bg-[linear-gradient(180deg,rgba(0,0,0,0.65),transparent)] px-[34px] py-[26px] transition-opacity duration-[350ms] ${fade}`}
      >
        <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.1)] text-white">
          <BackChevron />
        </div>
        <div>
          <div className="font-display text-[22px] font-bold text-white">{item.title}</div>
          <div className="font-sans text-[14px] font-medium text-[rgba(244,243,240,0.6)]">{subtitle}</div>
        </div>
        {warn ? (
          <div className="ml-auto rounded-full bg-[rgba(242,180,66,0.14)] px-3.5 py-2 font-sans text-[13px] font-semibold text-accent">{warn}</div>
        ) : null}
      </div>

      {/* bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.82),transparent)] px-[34px] pb-7 transition-opacity duration-[350ms] ${fade}`}
      >
        <div className="mb-[18px] flex items-center gap-4">
          <span className="w-16 font-sans text-[15px] font-semibold text-[rgba(244,243,240,0.85)] tabular-nums">{fmtTime(cur)}</span>
          <div
            className={`relative h-1.5 flex-1 rounded-full bg-[rgba(255,255,255,0.18)] transition-[transform,box-shadow] duration-200 ${
              zone === 'progress' && controls ? 'scale-y-150 shadow-[0_0_0_4px_rgba(242,180,66,0.35)]' : ''
            }`}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-[rgba(255,255,255,0.14)]" style={{ width: `${bufPct}%` }} />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--luma-accent),var(--luma-accent-bright))] shadow-[0_0_12px_rgba(242,180,66,0.55)]"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(242,180,66,0.4),0_2px_6px_rgba(0,0,0,0.5)]"
              style={{ left: `${pct}%` }}
            />
          </div>
          <span className="w-16 text-right font-sans text-[15px] font-semibold text-[rgba(244,243,240,0.55)] tabular-nums">{fmtTime(dur)}</span>
        </div>

        <div className="flex items-center justify-center gap-[22px] pt-1">
          <div className={`${CTRL} h-[70px] w-[70px] ${barFocus(0) ? `${FOCUS_RING} bg-[rgba(255,255,255,0.22)]` : 'bg-[rgba(255,255,255,0.12)]'}`}>
            <RewindGlyph />
          </div>
          <div className={`${CTRL} h-[84px] w-[84px] text-accent-ink ${barFocus(1) ? `${FOCUS_RING} bg-accent-hover` : 'bg-accent'}`}>
            {playing ? <PauseGlyph /> : <PlayGlyph />}
          </div>
          <div className={`${CTRL} h-[70px] w-[70px] ${barFocus(2) ? `${FOCUS_RING} bg-[rgba(255,255,255,0.22)]` : 'bg-[rgba(255,255,255,0.12)]'}`}>
            <ForwardGlyph />
          </div>
          <div
            className={`flex h-16 items-center gap-[11px] rounded-full px-7 font-sans text-[18px] font-bold text-white transition-[transform,box-shadow,background] duration-[180ms] ${
              barFocus(3) ? `${FOCUS_RING} bg-[rgba(255,255,255,0.22)]` : 'bg-[rgba(255,255,255,0.12)]'
            }`}
          >
            <TracksGlyph />
            Audio &amp; ST
          </div>
        </div>

        <div className="mt-4 text-center font-sans text-[14px] font-semibold text-dim">
          ▲ Barre de progression · ◀ ▶ Naviguer · OK Valider · Retour quitter
        </div>
      </div>

      {avOpen ? <AvPanel item={item} rendered={subs.rendered} options={subs.options} active={subs.active} focus={avFocus} /> : null}
    </div>
  );
}
