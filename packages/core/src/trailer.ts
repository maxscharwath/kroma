import type { MediaItem, TrailerReady } from '@kroma/client';

const H264 = {
  codec: 'h264',
  width: null,
  height: null,
  hdr: false,
  bitDepth: null,
} as const;

/** Rewrite a movie as the H.264 MP4 trailer the player should open, so engine
 * planning never follows the feature's HEVC file. */
export function asTrailerItem(item: MediaItem, ready: TrailerReady): MediaItem {
  return {
    ...item,
    container: 'mp4',
    durationMs: ready.durationMs ?? null,
    video: ready.video ?? { ...H264 },
    audio: {
      index: 0,
      codec: 'aac',
      channels: 2,
      language: ready.language || null,
      default: true,
    },
    audioTracks: [
      {
        index: 0,
        codec: 'aac',
        channels: 2,
        language: ready.language || null,
        default: true,
      },
    ],
    subtitles: [],
    files: [],
    markers: [],
    hasTrailer: true,
  };
}
