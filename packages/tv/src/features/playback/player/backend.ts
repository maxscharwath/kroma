// The NATIVE playback backend (Apple TV, Android TV): expo-video.
//
// The browser targets have five engines to choose between (a bare <video> plus
// hls.js, Samsung's AVPlay plane, mpv on the desktop shell, the Android TV
// ExoPlayer bridge) because each is the only way to reach a particular decoder
// from inside a WebView. A native app has no such problem: expo-video IS the
// platform player (AVPlayer on tvOS, Media3/ExoPlayer on Android TV), so this
// backend is one engine and the decision collapses to "direct-play the original
// file, or ask the server to remux it".
//
// See backend.web.ts for the browser half. The hook that drives playback
// (useDirectPlayback) imports from './backend' and never learns which it got.

import type { KromaClient, MediaItem } from '@kroma/core';
import {
  audioTrackId,
  audioTracksOf,
  nativeDirectPlayable,
  type PlayEnv,
  resolveAudioRelativeIndex,
} from '@kroma/core';
import type { AudioFilterMode } from '@kroma/ui';
import { Platform } from 'react-native';
import type { EnginePref } from '#tv/app/enginePref';
import type { EngineListeners, TvEngine } from '#tv/features/playback/player/engine';
import { ExpoVideoEngine } from '#tv/features/playback/player/expoVideoEngine';

/** The video surface an engine renders to. Natively there is only one: a
 * <VideoView> that sits in the tree like any other view, which is why the chrome
 * can transform it into the settings card exactly as it does an in-page video. */
export type Surface = 'video' | 'avplay' | 'mpv' | 'exo';

export type Engine = 'expo-direct' | 'expo-remux';

export interface EnginePlan {
  eng: Engine;
  surface: Surface;
  useMpv: boolean;
  useExo: boolean;
  useAvplay: boolean;
  avplayDirect: boolean;
  exoDirect: boolean;
  forceVlc: boolean;
  direct: boolean;
  masterAac: boolean;
  playbackMode: 'direct' | 'remux' | 'transcode';
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

/**
 * Direct-play or remux.
 *
 * `nativeDirectPlayable` asks whether THIS platform's player can open the
 * ORIGINAL file - container, video codec and audio codec. When it says no, the
 * server's remux-only pipeline repackages the file (video is always
 * stream-copied) and we play that instead.
 *
 * It takes the OS because the two native players disagree about containers, and
 * the guess is not free. This used to ask `avplayDirectPlayable`, which answers
 * for Samsung's AVPlay: that demuxes Matroska, AVFoundation does not, so every
 * MKV on Apple TV opened a player that was certain to fail, waited for it to say
 * "Cannot Open", and only then asked the server - two seconds of black screen
 * per title, and a released-player race in expo-video behind it.
 *
 * The engine preference is honoured only where it is meaningful: `remux` forces
 * the server path even for a file the device could have opened directly. The
 * browser-only prefs (avplay / mpv / exo / vlc / webview) have no native
 * counterpart and fall through to the automatic decision.
 */
export function planEngine(item: MediaItem, _env: PlayEnv, pref: EnginePref): EnginePlan {
  const os = Platform.OS === 'ios' ? 'ios' : 'android';
  const direct = pref !== 'remux' && nativeDirectPlayable(item, os);
  return {
    eng: direct ? 'expo-direct' : 'expo-remux',
    surface: 'video',
    useMpv: false,
    useExo: false,
    useAvplay: false,
    avplayDirect: false,
    exoDirect: false,
    forceVlc: false,
    direct,
    // The native players decode AC-3 / E-AC-3, so the server's master is
    // stream-copied and the audio is never re-encoded.
    masterAac: false,
    playbackMode: direct ? 'direct' : 'remux',
  };
}

/** Build the backend for a resolved plan. Always succeeds: unlike the web
 * `<video>` path there is no element to wait for, the player owns its surface. */
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
  return new ExpoVideoEngine({
    client: args.client,
    item: args.item,
    durationSec: args.durationSec,
    initialRendition: args.rendition,
    startSec: args.startSec,
    direct: args.direct,
    audioFilter: args.audioFilter,
    listeners: args.listeners,
  });
}
