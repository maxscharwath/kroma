// The WEB playback backend: which engine to build for an item on a browser
// target, and how to build it.
//
// Everything platform-specific about playback lives behind this module and its
// native sibling (backend.ts). The hook that drives playback (useDirectPlayback)
// imports `planEngine` and `createTvEngine` from './backend' and never learns
// which one it got: a bare <video> plus hls.js, Samsung's AVPlay plane, mpv on
// the desktop shell, the Android TV ExoPlayer bridge, or expo-video natively.

import type { KromaClient, MediaItem } from '@kroma/core';
import {
  audioTrackId,
  audioTracksOf,
  avplayDirectPlayable,
  canDirectPlay,
  NATIVE_TV_CAPS,
  type PlayEnv,
  resolveAudioRelativeIndex,
  selectEngine,
} from '@kroma/core';
import type { AudioFilterMode } from '@kroma/ui';
import { availableEngines, type EnginePref } from '#tv/app/enginePref';
import { AvplayEngine } from '#tv/features/playback/player/avplayEngine';
import {
  avplayAvailable,
  type EngineListeners,
  exoAvailable,
  mpvAvailable,
  type TvEngine,
} from '#tv/features/playback/player/engine';
import { ExoEngine } from '#tv/features/playback/player/exoEngine';
import { HtmlEngine } from '#tv/features/playback/player/htmlEngine';
import { MpvEngine } from '#tv/features/playback/player/mpvEngine';

/** The video surface an engine renders to. `video` is an in-tree element the
 * chrome can transform; the others are planes behind a transparent page. */
export type Surface = 'video' | 'avplay' | 'mpv' | 'exo';

/** The concrete backend to build for this item. */
export type Engine = 'mpv' | 'exo' | 'avplay' | 'video-direct' | 'video-remux';

/** The backend the user explicitly asked for, or `null` when the pref is `auto` or
 * names an engine this platform can't run (e.g. `mpv` off the Linux shell,
 * `avplay` off Tizen) - both fall through to the automatic decision. */
function manualEngine(pref: EnginePref, tizenNative: boolean): Engine | null {
  if (pref === 'avplay' && tizenNative) return 'avplay';
  if (pref === 'webview') return 'video-direct';
  if (pref === 'remux') return 'video-remux';
  if (pref === 'mpv' && mpvAvailable()) return 'mpv';
  if (pref === 'exo' && exoAvailable()) return 'exo';
  // libVLC runs on the same native bridge as ExoPlayer (surface 'exo'); the
  // forceVlc flag (see planEngine) tells the bridge to software-decode from the start.
  if (pref === 'vlc' && exoAvailable()) return 'exo';
  return null;
}

/** The automatic backend for this platform: native planes where they exist
 * (AVPlay on Tizen for hardware surround, mpv on the desktop shell, ExoPlayer on
 * Android TV), else `<video>` direct-play or the server remux. */
function autoEngine(env: PlayEnv, tizenNative: boolean, autoDirect: boolean): Engine {
  if (tizenNative) return 'avplay';
  if (env.platform === 'desktop' && mpvAvailable()) return 'mpv';
  if (env.platform === 'androidtv' && exoAvailable()) return 'exo';
  return autoDirect ? 'video-direct' : 'video-remux';
}

/** Resolve the backend from the user's engine preference, falling back to the
 * automatic decision. `auto` on Tizen keeps AVPlay (hardware surround), but the user
 * can force the HTML5 (`<video>` + hls.js) remux path instead. */
function resolveEngine(pref: EnginePref, env: PlayEnv, autoDirect: boolean): Engine {
  // A stored engine no longer offered on this platform (e.g. a device left on
  // `remux` after it was retired on Android TV, where the WebView cannot decode
  // HEVC) must not strand playback on a dead engine - degrade it to `auto`.
  const wanted = pref !== 'auto' && availableEngines().includes(pref) ? pref : 'auto';
  const tizenNative = env.platform === 'tizen' && avplayAvailable();
  return manualEngine(wanted, tizenNative) ?? autoEngine(env, tizenNative, autoDirect);
}

/** A plain, single-audio MP4 a bare TV `<video>` direct-plays natively. */
function tvDirectPlay(item: MediaItem): boolean {
  const container = (item.container ?? '').toLowerCase();
  if (container !== 'mp4' && container !== 'mov' && container !== 'm4v') return false;
  if (!canDirectPlay(item, NATIVE_TV_CAPS).canDirectPlay) return false;
  return audioTracksOf(item).length <= 1;
}

/** Container MIME the webview needs to demux a bare `<video src>`. */
const CONTAINER_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
};

/** Whether the webview can demux this item's container for a direct `<video src>`.
 * Safari / WKWebView has no Matroska (MKV) or AVI demuxer, so a forced direct-play
 * on one loads forever at HAVE_NOTHING with no error - callers fall back to the
 * server remux (which repackages it into a webview-playable stream) instead. */
function webviewCanDirectPlay(item: MediaItem): boolean {
  if (typeof document === 'undefined') return true;
  const mime = CONTAINER_MIME[(item.container ?? '').toLowerCase()];
  if (!mime) return false;
  return document.createElement('video').canPlayType(mime) !== '';
}

/** The audio-relative rendition to select for the chosen track, resolved from a
 * stable identity so a reordered track list still picks the right language. */
export function renditionFor(item: MediaItem, audioIndex: number): number {
  const tracks = audioTracksOf(item);
  const want =
    tracks.find((t) => t.index === audioIndex) ?? tracks.find((t) => t.default) ?? tracks[0];
  if (!want) return 0;
  return resolveAudioRelativeIndex(tracks, audioTrackId(want));
}

/** The resolved backend plan for an item: which engine + surface, the direct-play
 * flags, and the heartbeat playback mode. Pure (no React) so it stays out of the
 * hook body. */
export interface EnginePlan {
  eng: Engine;
  surface: Surface;
  useMpv: boolean;
  useExo: boolean;
  useAvplay: boolean;
  avplayDirect: boolean;
  exoDirect: boolean;
  /** The user forced the "libVLC" engine: play every item through libVLC (software
   * decode) from the start, on the ExoPlayer bridge/surface. */
  forceVlc: boolean;
  direct: boolean;
  masterAac: boolean;
  playbackMode: 'direct' | 'remux' | 'transcode';
}

/** mpv / ExoPlayer / AVPlay render to their own plane behind the transparent UI,
 * so none of them uses an in-page media element. */
function surfaceFor(useMpv: boolean, useExo: boolean, useAvplay: boolean): Surface {
  if (useMpv) return 'mpv';
  if (useExo) return 'exo';
  if (useAvplay) return 'avplay';
  return 'video';
}

/** Video is always copied. AVPlay-direct plays the original file (direct);
 * AVPlay-master passes surround through (remux); only the hls.js AAC master
 * (webOS / MSE without AC3) re-encodes audio (transcode). */
function playbackModeFor(flags: {
  useMpv: boolean;
  useExo: boolean;
  useAvplay: boolean;
  exoDirect: boolean;
  avplayDirect: boolean;
  direct: boolean;
  aacMaster: boolean;
}): 'direct' | 'remux' | 'transcode' {
  const { useMpv, useExo, useAvplay, exoDirect, avplayDirect, direct, aacMaster } = flags;
  if (useMpv) return 'direct'; // mpv opens the original file (master only on fallback)
  if (useExo) return exoDirect ? 'direct' : 'remux';
  if (useAvplay) return avplayDirect ? 'direct' : 'remux';
  if (!direct) return aacMaster ? 'transcode' : 'remux';
  return 'direct';
}

/** Resolve the concrete backend decision for an item + environment + user pref. */
export function planEngine(item: MediaItem, env: PlayEnv, pref: EnginePref): EnginePlan {
  const decision = selectEngine(item, env);
  const autoDirect = decision.kind === 'direct' || tvDirectPlay(item);
  // The user can override the automatic engine (profile menu -> Playback engine);
  // `auto` follows selectEngine.
  let eng = resolveEngine(pref, env, autoDirect);
  // A direct `<video>` on a container the webview can't demux (MKV/AVI in Safari)
  // would spin forever, so fall back to the server remux which repackages it.
  if (eng === 'video-direct' && !webviewCanDirectPlay(item)) eng = 'video-remux';
  const useMpv = eng === 'mpv';
  const useExo = eng === 'exo';
  const useAvplay = eng === 'avplay';
  // The user forced libVLC (runs on the exo bridge). It software-decodes ANY
  // codec, so it always opens the ORIGINAL file directly (no pointless server
  // remux), regardless of what the device's hardware decoders can handle.
  const forceVlc = useExo && pref === 'vlc';
  // ExoPlayer demuxes (at least) the same container set AVPlay does, so the same
  // gate decides whether it opens the ORIGINAL file (zero server work).
  const avplayDirect = useAvplay && avplayDirectPlayable(item);
  const exoDirect = useExo && (forceVlc || avplayDirectPlayable(item));
  const direct = eng === 'video-direct';
  return {
    eng,
    surface: surfaceFor(useMpv, useExo, useAvplay),
    useMpv,
    useExo,
    useAvplay,
    avplayDirect,
    exoDirect,
    forceVlc,
    direct,
    // Env-aware: Safari's native HLS decodes AC3/E-AC3 so its master is stream-copied
    // (5.1 kept); Chromium/webOS MSE can't, so `selectEngine` marks those AAC.
    masterAac: decision.aacMaster,
    playbackMode: playbackModeFor({
      useMpv,
      useExo,
      useAvplay,
      exoDirect,
      avplayDirect,
      direct,
      aacMaster: decision.aacMaster,
    }),
  };
}

/** Build the concrete backend for a resolved plan. Returns `null` only when the
 * in-page `<video>` surface isn't mounted yet (the caller retries next render); the
 * native-plane engines are always constructed. */
export function createTvEngine(args: {
  eng: Engine;
  client: KromaClient;
  item: MediaItem;
  durationSec: number;
  rendition: number;
  startSec: number;
  exoDirect: boolean;
  avplayDirect: boolean;
  forceVlc: boolean;
  direct: boolean;
  masterAac: boolean;
  audioFilter: AudioFilterMode;
  forceNativeHls: boolean | undefined;
  video: HTMLVideoElement | null;
  listeners: EngineListeners;
}): TvEngine | null {
  const {
    eng,
    client,
    item,
    durationSec,
    rendition,
    startSec,
    exoDirect,
    avplayDirect,
    forceVlc,
    direct,
    masterAac: aacMaster,
    audioFilter,
    forceNativeHls,
    video,
    listeners,
  } = args;
  if (eng === 'mpv') {
    // Native mpv opens the original file directly (VA-API decode); an internal
    // direct->master fallback covers the rare file it cannot demux.
    const engine = new MpvEngine({
      client,
      item,
      durationSec,
      initialRendition: rendition,
      startSec,
      direct: true,
      audioFilter,
      listeners,
    });
    engine.start(); // async subscribe/open kept out of the constructor
    return engine;
  }
  if (eng === 'exo') {
    // Native ExoPlayer opens the original file directly (hardware decode); an
    // internal direct->master fallback covers the rare file it cannot open.
    // `forceVlc` makes libVLC the primary player (software-decode every codec).
    return new ExoEngine({
      client,
      item,
      durationSec,
      initialRendition: rendition,
      startSec,
      direct: exoDirect,
      forceVlc,
      audioFilter,
      listeners,
    });
  }
  if (eng === 'avplay') {
    return new AvplayEngine({
      client,
      item,
      durationSec,
      initialRendition: rendition,
      startSec,
      direct: avplayDirect,
      audioFilter,
      listeners,
    });
  }
  if (!video) return null;
  return new HtmlEngine({
    video,
    client,
    item,
    direct,
    masterAac: aacMaster,
    forceNativeHls,
    initialRendition: rendition,
    durationSec,
    startSec,
    listeners,
  });
}
