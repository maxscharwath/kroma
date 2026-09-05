import type { MediaItem, TrailerReady } from '@kroma/client';
import { describe, expect, it } from 'vitest';
import { asTrailerItem } from './trailer';

const ITEM = {
  id: 'm1',
  title: 'Dune',
  kind: 'movie',
  container: 'mkv',
  durationMs: 9_000_000,
  video: { codec: 'hevc', width: 3840, height: 1600, hdr: true, bitDepth: 10 },
  audio: { index: 0, codec: 'truehd', channels: 8, language: 'en', default: true },
  audioTracks: [{ index: 0, codec: 'truehd', channels: 8, language: 'en', default: true }],
  subtitles: [{ language: 'en', codec: 'subrip' }],
  files: [{ id: 'f1' }],
  markers: [{ kind: 'intro', startMs: 0, endMs: 90_000 }],
} as unknown as MediaItem;

const READY: TrailerReady = {
  language: 'fr',
  key: 'abc',
  durationMs: 120_000,
  container: 'mp4',
  video: { codec: 'h264', width: 1920, height: 1080, hdr: false, bitDepth: 8 },
  state: 'ready',
  percent: 100,
};

describe('asTrailerItem', () => {
  it('patches the movie into a direct-playable H.264 MP4 and drops the feature files', () => {
    const trailer = asTrailerItem(ITEM, READY);

    expect(trailer.container).toBe('mp4');
    expect(trailer.durationMs).toBe(120_000);
    expect(trailer.video).toEqual(READY.video);
    expect(trailer.audio?.codec).toBe('aac');
    expect(trailer.files).toEqual([]);
    expect(trailer.markers).toEqual([]);
    expect(trailer.subtitles).toEqual([]);
    expect(trailer.title).toBe('Dune');
  });

  it('does not keep the movie runtime when the trailer length is unknown', () => {
    const trailer = asTrailerItem(ITEM, { ...READY, durationMs: undefined });

    expect(trailer.durationMs).toBeNull();
  });
});
