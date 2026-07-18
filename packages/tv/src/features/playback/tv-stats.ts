import type { AudioTrack, MediaItem, Translate } from '@kroma/core';
import type { PlayerStats } from '@kroma/ui';

export interface TvStatsInput {
  item: MediaItem;
  cur: number;
  dur: number;
  bufEnd: number;
  audioTracks: AudioTrack[];
  audioIndex: number;
  /** The in-page <video> (webOS / html engine) for decode counters; null for
   *  native planes (AVPlay / mpv / exo). */
  video: HTMLVideoElement | null;
  mode: string;
  t: Translate;
}

/**
 * "Stats for nerds" (§9) for the TV player. Native surfaces expose no decode
 * counters, so this is a lean snapshot from the item metadata + engine clock,
 * enriched with dropped frames only when an in-page <video> is present.
 */
export function buildTvStats(s: TvStatsInput): PlayerStats {
  const { item, cur, dur, bufEnd, audioTracks, audioIndex, video, mode, t } = s;
  const selAudio = audioTracks.find((a) => a.index === audioIndex) ?? audioTracks[0];
  const vw = video?.videoWidth || item.video?.width || 0;
  const vh = video?.videoHeight || item.video?.height || 0;
  const q = video?.getVideoPlaybackQuality?.();

  return {
    mode,
    resolution: vw && vh ? `${vw}×${vh}` : undefined,
    videoCodec: item.video
      ? `${item.video.codec.toUpperCase()}${item.video.bitDepth ? ` ${item.video.bitDepth}-bit` : ''}${item.video.hdr ? ' HDR' : ''}`
      : undefined,
    audioFormat: selAudio
      ? `${selAudio.codec.toUpperCase()}${selAudio.channels ? ` ${selAudio.channels}.0` : ''}${selAudio.language ? ` (${selAudio.language})` : ''}`
      : undefined,
    buffer: t('stats.bufferAhead', { seconds: Math.max(0, bufEnd - cur).toFixed(1) }),
    dropped: q ? `${q.droppedVideoFrames} / ${q.totalVideoFrames}` : undefined,
    extra: [
      { label: t('stats.title2'), value: item.title },
      { label: t('stats.container'), value: (item.container ?? '').toUpperCase() },
      { label: t('stats.position'), value: `${Math.floor(cur)}s / ${Math.floor(dur)}s` },
    ],
  };
}
