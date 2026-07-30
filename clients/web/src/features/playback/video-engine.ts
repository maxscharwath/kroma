// The imperative playback engine for the player: the `<video>` element event
// wiring and the source decision (direct-play vs the HLS remux master).
// `useVideoPlayback` owns the React state/effects and drives these helpers.
//
// The HLS master is remuxed from an anchor (input `-ss`); hls.js plays it from
// RELATIVE 0, so the hook reports the absolute position as `anchor + currentTime`
// (see `baseSec`). A seek outside the produced range re-anchors: the parent
// remounts the <video> with a fresh remux at the target.

import type { AudioTrack, EngineDecision } from '@kroma/core';
import type { WebEnginePref } from '#web/features/playback/engine-pref';
import { kromaClient, type MovieView } from '#web/shared/lib/api';

export type HlsInstance = import('hls.js').default;

// Forward-buffer tuning, shared intent across the MSE engines: buffer well ahead
// so playback rides out network dips instead of stalling. The engine defaults are
// stingy - hls.js caps at 30s AND 60 MB (the byte cap is what stops high-bitrate
// streams at ~15-30s), and Shaka's `bufferingGoal` is only 10s. The server remux
// produces ahead (readrate 1.5 + burst), so a bigger client goal actually fills.
const FORWARD_BUFFER_SEC = 120;
const MAX_FORWARD_BUFFER_SEC = 600;
const BACK_BUFFER_SEC = 60;
const MAX_BUFFER_BYTES = 500 * 1000 * 1000; // 500 MB (vs hls.js's 60 MB default)

/** The subset of Shaka's live `getStats()` snapshot the stats panel reads; bandwidth
 * is bits/s, times are seconds. */
export interface ShakaStatsLike {
  streamBandwidth: number;
  estimatedBandwidth: number;
  stallsDetected: number;
  bufferingTime: number;
  bytesDownloaded: number;
  currentCodecs: string;
  droppedFrames: number;
  decodedFrames: number;
}

/** The slice of the Shaka Player API this engine touches, typed structurally
 * rather than pulling Shaka's generated namespace types into the hook. */
export interface ShakaPlayerLike {
  attach(media: HTMLMediaElement): Promise<void>;
  load(uri: string, startTime?: number | null): Promise<void>;
  destroy(): Promise<void>;
  getStats(): ShakaStatsLike;
  configure(config: Record<string, unknown>): boolean;
}
interface ShakaStatic {
  Player: { new (): ShakaPlayerLike; isBrowserSupported(): boolean };
  polyfill: { installAll(): void };
}

export interface VideoPlayback {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  barRef: React.RefObject<HTMLDivElement | null>;
  playing: boolean;
  waiting: boolean;
  ready: boolean;
  cur: number;
  dur: number;
  bufEnd: number;
  volume: number;
  muted: boolean;
  rate: number;
  fs: boolean;
  useHls: boolean;
  enginePref: WebEnginePref;
  /** Persists the choice and re-anchors playback to apply it live. */
  setEnginePref: (p: WebEnginePref) => void;
  audioTracks: AudioTrack[];
  audioIndex: number;
  setAudio: (index: number) => void;
  /** The remux anchor (s), used as the `<video>` React key so a resume/seek
   * remounts the element rather than re-attaching hls.js. */
  anchor: number;
  baseSec: number;
  aac: boolean;
  hlsRef: { current: HlsInstance | null };
  shakaRef: { current: ShakaPlayerLike | null };
  scrubbing: boolean;
  setScrubbing: (v: boolean) => void;
  scrubPreview: number | null;
  scrubToClientX: (clientX: number) => void;
  commitScrub: () => void;
  /** `x`: px from the bar's left; `t`: the time there (s); `w`: the bar's pixel
   * width. */
  hover: { x: number; t: number; w: number } | null;
  setHover: (h: { x: number; t: number; w: number } | null) => void;
  togglePlay: () => void;
  skip: (delta: number) => void;
  seekTo: (absSec: number) => void;
  getPosition: () => number;
  setVol: (val: number) => void;
  toggleMute: () => void;
  applyRate: (r: number) => void;
  toggleFullscreen: () => void;
  seekToClientX: (clientX: number) => void;
  onBarMove: (e: React.PointerEvent) => void;
}

/** State setters the media-event listeners feed into. */
export interface MediaEventSetters {
  setCur: (n: number) => void;
  setDur: (n: number) => void;
  setBufEnd: (n: number) => void;
  setPlaying: (b: boolean) => void;
  setWaiting: (b: boolean) => void;
  setVolume: (n: number) => void;
  setMuted: (b: boolean) => void;
  setRate: (n: number) => void;
  setReady: (b: boolean) => void;
}

/** Subscribes the media element's events to the state setters and drives a
 * resilient, ready-gated autoplay. Returns the unsubscribe cleanup. */
export function bindMediaEvents(
  v: HTMLVideoElement,
  item: MovieView,
  setters: MediaEventSetters,
  baseSec = 0,
  /** Total length (ms) from the catalog or the server's `X-Media-Duration`
   * header; preferred over the element's `duration`, which for a growing HLS
   * EVENT playlist is only the produced edge, not the whole movie. 0 = unknown,
   * fall back to the element clock. */
  knownDurationMs = 0,
): () => void {
  const {
    setCur,
    setDur,
    setBufEnd,
    setPlaying,
    setWaiting,
    setVolume,
    setMuted,
    setRate,
    setReady,
  } = setters;
  const durMs = knownDurationMs || item.durationMs || 0;
  const onTime = () => setCur(baseSec + v.currentTime);
  const onDur = () => {
    const total = durMs ? durMs / 1000 : 0;
    if (total > 0) setDur(total);
    else if (Number.isFinite(v.duration)) setDur(baseSec + v.duration);
  };
  const onProg = () =>
    setBufEnd(v.buffered.length ? baseSec + v.buffered.end(v.buffered.length - 1) : 0);
  const onPause = () => setPlaying(false);
  const onWaiting = () => setWaiting(true);
  const onPlaying = () => setWaiting(false);
  const onVol = () => {
    setVolume(v.volume);
    setMuted(v.muted);
  };
  const onRate = () => setRate(v.playbackRate);

  // Ready-gated, resilient autoplay: retry on the media-ready events until
  // playback actually starts, then stop so we never fight a real user pause.
  let started = false;
  const onReady = () => {
    setReady(true);
    if (started || !v.paused) return;
    const p = v.play();
    p?.catch(() => undefined);
  };
  const onStarted = () => {
    started = true;
    setPlaying(true);
  };

  v.addEventListener('timeupdate', onTime);
  v.addEventListener('durationchange', onDur);
  v.addEventListener('progress', onProg);
  v.addEventListener('play', onStarted);
  v.addEventListener('pause', onPause);
  v.addEventListener('waiting', onWaiting);
  v.addEventListener('playing', onPlaying);
  v.addEventListener('volumechange', onVol);
  v.addEventListener('ratechange', onRate);
  v.addEventListener('loadedmetadata', onReady);
  v.addEventListener('loadeddata', onReady);
  v.addEventListener('canplay', onReady);
  return () => {
    v.removeEventListener('timeupdate', onTime);
    v.removeEventListener('durationchange', onDur);
    v.removeEventListener('progress', onProg);
    v.removeEventListener('play', onStarted);
    v.removeEventListener('pause', onPause);
    v.removeEventListener('waiting', onWaiting);
    v.removeEventListener('playing', onPlaying);
    v.removeEventListener('volumechange', onVol);
    v.removeEventListener('ratechange', onRate);
    v.removeEventListener('loadedmetadata', onReady);
    v.removeEventListener('loadeddata', onReady);
    v.removeEventListener('canplay', onReady);
  };
}

/** Inputs for {@link attachMediaSource}. */
export interface AttachSourceOptions {
  v: HTMLVideoElement;
  item: MovieView;
  decision: EngineDecision;
  /** Use the browser's native HLS (Safari/iOS) instead of hls.js. */
  useNativeHls: boolean;
  /** Play the HLS master through Shaka Player instead of hls.js / native HLS.
   * Set when the user picks the `shaka` engine override; wins over `useNativeHls`
   * so an explicit Shaka choice is honoured even on Safari. */
  useShaka: boolean;
  /** Anchor position (s): the HLS stream is remuxed from here (input `-ss`); the
   * hook adds it back for the absolute position. For direct-play it is a plain
   * absolute start seek. 0 = from the start. */
  startSec: number;
  /** Audio-relative track index to MUX into the stream (the chosen language). */
  audioRel: number;
  hlsRef: { current: HlsInstance | null };
  /** The live Shaka Player instance (or null), so the stats panel can read its
   * `getStats()` transport metrics. Only set on the `useShaka` path. */
  shakaRef: { current: ShakaPlayerLike | null };
  setUseHls: (b: boolean) => void;
  setReady: (b: boolean) => void;
}

/** Direct-play resume: seek to the absolute `startSec` once the element has
 * metadata (direct-play is one continuous, fully-seekable file). */
function seekToAnchor(v: HTMLVideoElement, startSec: number): void {
  if (startSec <= 0.5) return;
  const apply = () => {
    if (Math.abs(v.currentTime - startSec) > 1) {
      try {
        v.currentTime = startSec;
      } catch {
        /* not ready yet retried below */
      }
    }
  };
  if (v.readyState >= 1) apply();
  else v.addEventListener('loadedmetadata', apply, { once: true });
}

/**
 * Point the media element at the right source: plain direct-play for a compatible
 * single-audio MP4, otherwise the HLS stream anchored at `startSec` with the
 * chosen audio (`audioRel`) muxed in. A resume / seek / language change re-attaches
 * (the parent remounts the element); there is no in-place audio switch.
 */
export function attachMediaSource(opts: AttachSourceOptions): () => void {
  const {
    v,
    item,
    decision,
    useNativeHls,
    useShaka,
    startSec,
    audioRel,
    hlsRef,
    shakaRef,
    setUseHls,
    setReady,
  } = opts;
  setReady(false);

  if (decision.kind === 'direct') {
    setUseHls(false);
    v.src = item.stream;
    v.preload = 'auto';
    seekToAnchor(v, startSec);
    return () => {
      v.removeAttribute('src');
      v.load();
    };
  }

  setUseHls(true);
  // The HLS session is remuxed from `startSec` (server input -ss) with `audioRel`
  // muxed in. hls.js plays it from RELATIVE 0, and the hook adds `startSec` back
  // to report the absolute position (bindMediaEvents `baseSec`). No client seek.
  const url = kromaClient().hlsMasterUrl(item.id, decision.aacMaster, startSec, audioRel);
  let destroyed = false;

  if (useShaka) {
    // Shaka plays the same anchored master over MSE (like hls.js). It reports the
    // stream's own relative clock, so the hook still adds `startSec` back for the
    // absolute position (bindMediaEvents `baseSec`). The chosen audio is muxed in
    // via the URL, so there is no in-place rendition switch here either.
    void import('shaka-player/dist/shaka-player.compiled.js').then((mod) => {
      if (destroyed) return;
      const shaka = (mod as unknown as { default: ShakaStatic }).default;
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) {
        v.src = url; // let the element's native HLS (if any) try
        return;
      }
      const player = new shaka.Player();
      shakaRef.current = player;
      // Buffer far ahead: Shaka's default bufferingGoal is only 10s.
      player.configure({
        streaming: {
          bufferingGoal: FORWARD_BUFFER_SEC,
          bufferBehind: BACK_BUFFER_SEC,
          rebufferingGoal: 4,
        },
      });
      player
        .attach(v)
        .then(() => player.load(url))
        .catch(() => undefined);
    });
    return () => {
      destroyed = true;
      void shakaRef.current?.destroy();
      shakaRef.current = null;
      v.removeAttribute('src');
      v.load();
    };
  }

  if (useNativeHls) {
    v.src = url; // Safari/iOS: native HLS plays the muxed program
    v.preload = 'auto';
    return () => {
      v.removeAttribute('src');
      v.load();
    };
  }

  void import('hls.js').then(({ default: Hls }) => {
    if (destroyed) return;
    if (!Hls.isSupported()) {
      v.src = url;
      return;
    }
    // startPosition 0 = the start of the (relative) anchored stream. The buffer
    // caps are raised well above hls.js's stingy 30s / 60 MB defaults so playback
    // buffers far ahead (see FORWARD_BUFFER_SEC).
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      startPosition: 0,
      maxBufferLength: FORWARD_BUFFER_SEC,
      maxMaxBufferLength: MAX_FORWARD_BUFFER_SEC,
      maxBufferSize: MAX_BUFFER_BYTES,
      backBufferLength: BACK_BUFFER_SEC,
    });
    hlsRef.current = hls;
    hls.loadSource(url);
    hls.attachMedia(v);
  });

  return () => {
    destroyed = true;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    v.removeAttribute('src');
    v.load();
  };
}
