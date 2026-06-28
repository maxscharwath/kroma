import { useCallback, useEffect, useRef, useState } from 'react';
import { audioSupport, canDirectPlay } from '@luma/core';
import type { MovieView } from '#web/lib/api';

export interface VideoPlayback {
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  barRef: React.RefObject<HTMLDivElement>;
  playing: boolean;
  waiting: boolean;
  cur: number;
  dur: number;
  bufEnd: number;
  volume: number;
  muted: boolean;
  rate: number;
  fs: boolean;
  /** True when audio is being re-encoded to AAC via an HLS variant. */
  useHls: boolean;
  scrubbing: boolean;
  setScrubbing: (v: boolean) => void;
  hover: { x: number; t: number } | null;
  setHover: (h: { x: number; t: number } | null) => void;
  togglePlay: () => void;
  skip: (delta: number) => void;
  setVol: (val: number) => void;
  toggleMute: () => void;
  applyRate: (r: number) => void;
  toggleFullscreen: () => void;
  togglePip: () => void;
  seekToClientX: (clientX: number) => void;
  onBarMove: (e: React.PointerEvent) => void;
}

/**
 * Owns the `<video>` element: playback state (time/duration/buffer/volume/rate),
 * the source decision (direct-play `<video src>` vs an HLS audio-transcode for
 * codecs the browser can't decode), fullscreen tracking, and every transport
 * action. Capability detection needs the DOM, so the source is resolved post-mount.
 */
export function useVideoPlayback(item: MovieView): VideoPlayback {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(item.durationMs ? item.durationMs / 1000 : 0);
  const [bufEnd, setBufEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fs, setFs] = useState(false);
  const [useHls, setUseHls] = useState(false);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  // ----- video element wiring -------------------------------------------------
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCur(v.currentTime);
    const onDur = () => setDur(v.duration || 0);
    const onProg = () => setBufEnd(v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onVol = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    const onRate = () => setRate(v.playbackRate);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('progress', onProg);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('volumechange', onVol);
    v.addEventListener('ratechange', onRate);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('progress', onProg);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('volumechange', onVol);
      v.removeEventListener('ratechange', onRate);
    };
  }, []);

  // ----- source wiring: direct-play <video src> vs HLS audio-transcode --------
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const hlsNeeded = !audioSupport(item).canPlay && canDirectPlay(item).canDirectPlay;
    setUseHls(hlsNeeded);

    if (!hlsNeeded) {
      v.src = item.stream; // direct-play: server range-streams the original file
      return;
    }

    // Audio-transcode: copy video, re-encode audio to stereo AAC, delivered as HLS.
    let destroyed = false;
    let hls: import('hls.js').default | null = null;

    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari/iOS play HLS natively (and decode AC3 natively, so they rarely
      // reach this branch — but handle it for completeness).
      v.src = item.hlsAudio;
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) {
          v.src = item.hlsAudio; // last resort
          return;
        }
        hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(item.hlsAudio);
        hls.attachMedia(v);
      });
    }

    return () => {
      destroyed = true;
      hls?.destroy();
      v.removeAttribute('src');
      v.load();
    };
  }, [item]);

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ----- actions --------------------------------------------------------------
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const skip = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  }, []);

  const seekToClientX = useCallback((clientX: number) => {
    const v = videoRef.current;
    const bar = barRef.current;
    if (!v || !bar || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
  }, []);

  const onBarMove = useCallback(
    (e: React.PointerEvent) => {
      const bar = barRef.current;
      if (!bar || !dur) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHover({ x: pct * rect.width, t: pct * dur });
      if (scrubbing) seekToClientX(e.clientX);
    },
    [dur, scrubbing, seekToClientX],
  );

  const setVol = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, val));
    v.muted = v.volume === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const applyRate = useCallback((r: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = r;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  const togglePip = useCallback(() => {
    const v = videoRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null;
    if (!v) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void v.requestPictureInPicture?.();
  }, []);

  return {
    videoRef,
    containerRef,
    barRef,
    playing,
    waiting,
    cur,
    dur,
    bufEnd,
    volume,
    muted,
    rate,
    fs,
    useHls,
    scrubbing,
    setScrubbing,
    hover,
    setHover,
    togglePlay,
    skip,
    setVol,
    toggleMute,
    applyRate,
    toggleFullscreen,
    togglePip,
    seekToClientX,
    onBarMove,
  };
}
