import { describe, expect, it } from 'vitest';
import type { AudioTrack, MediaItem, Translate } from '@kroma/core';
import { buildTvStats, type TvStatsInput } from './tv-stats';

const t: Translate = ((key: string, vars?: unknown) =>
  vars ? `${key}(${JSON.stringify(vars)})` : key) as Translate;

const item = {
  title: 'Interstellar',
  container: 'mkv',
  video: { codec: 'hevc', bitDepth: 10, hdr: true, width: 3840, height: 1600 },
} as unknown as MediaItem;

const audioTracks: AudioTrack[] = [
  { index: 0, codec: 'eac3', channels: 6, language: 'en', default: true } as AudioTrack,
  { index: 5, codec: 'ac3', channels: 2, language: 'fr', default: false } as AudioTrack,
];

const input = (over: Partial<TvStatsInput> = {}): TvStatsInput =>
  ({
    item,
    cur: 30,
    dur: 8880,
    bufEnd: 45,
    audioTracks,
    audioIndex: 0,
    video: null, // native plane (avplay/mpv/exo): no decode counters
    mode: 'AVPlay',
    t,
    ...over,
  }) as TvStatsInput;

describe('buildTvStats', () => {
  it('builds a metadata snapshot for a native surface', () => {
    const s = buildTvStats(input());
    expect(s.mode).toBe('AVPlay');
    expect(s.resolution).toBe('3840×1600');
    expect(s.videoCodec).toBe('HEVC 10-bit HDR');
    expect(s.audioFormat).toBe('EAC3 6.0 (en)');
    expect(s.dropped).toBeUndefined(); // no <video>, no frame counters
  });

  it('formats buffer-ahead as (bufEnd - cur), clamped at 0', () => {
    expect(buildTvStats(input({ cur: 30, bufEnd: 45 })).buffer).toBe(
      'stats.bufferAhead({"seconds":"15.0"})',
    );
    expect(buildTvStats(input({ cur: 60, bufEnd: 45 })).buffer).toBe(
      'stats.bufferAhead({"seconds":"0.0"})',
    );
  });

  it('selects the audio track by its index, falling back to the first', () => {
    expect(buildTvStats(input({ audioIndex: 5 })).audioFormat).toBe('AC3 2.0 (fr)');
    expect(buildTvStats(input({ audioIndex: 99 })).audioFormat).toBe('EAC3 6.0 (en)');
  });

  it('has no audio format when there are no audio tracks', () => {
    expect(buildTvStats(input({ audioTracks: [] })).audioFormat).toBeUndefined();
  });

  it('omits resolution / codec when the item carries no video metadata', () => {
    const noVideo = { ...item, video: null } as unknown as MediaItem;
    const s = buildTvStats(input({ item: noVideo }));
    expect(s.resolution).toBeUndefined();
    expect(s.videoCodec).toBeUndefined();
  });

  it('emits title, upper-cased container and a position row in extra', () => {
    const rows = buildTvStats(input()).extra ?? [];
    expect(rows.find((r) => r.label === 'stats.title2')?.value).toBe('Interstellar');
    expect(rows.find((r) => r.label === 'stats.container')?.value).toBe('MKV');
    expect(rows.find((r) => r.label === 'stats.position')?.value).toBe('30s / 8880s');
  });
});
