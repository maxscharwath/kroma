import type { AudioTrack, Translate } from '@kroma/core';
import { describe, expect, it } from 'vitest';
import type { MovieView } from '../../shared/lib/api';
import { buildWebStats, type WebStatsInput } from './web-stats';

// Echo the key + vars so we can assert which catalog string a field used without
// depending on the real i18n catalog.
const t: Translate = ((key: string, vars?: unknown) =>
  vars ? `${key}(${JSON.stringify(vars)})` : key) as Translate;

const item = {
  title: 'Blade Runner 2049',
  container: 'mkv',
  video: { codec: 'hevc', bitDepth: 10, hdr: true, width: 3840, height: 2160 },
  audio: { codec: 'eac3' },
} as unknown as MovieView;

const audioTracks: AudioTrack[] = [
  { index: 0, codec: 'eac3', channels: 6, language: 'fr', default: true } as AudioTrack,
  { index: 1, codec: 'aac', channels: 2, language: 'en', default: false } as AudioTrack,
];

// v: null keeps this in the node env (no <video>): metrics degrade to metadata.
const input = (over: Partial<WebStatsInput> = {}): WebStatsInput =>
  ({
    v: null,
    item,
    cur: 40,
    dur: 3600,
    bufEnd: 100,
    useHls: true,
    aac: false,
    anchor: 12,
    baseSec: 10,
    audioTracks,
    audioIndex: 0,
    hlsRef: { current: null },
    bytes: 1_000_000_000,
    t,
    ...over,
  }) as WebStatsInput;

describe('buildWebStats', () => {
  it('summarises an HLS copy stream from the item metadata', () => {
    const s = buildWebStats(input());
    expect(s.mode).toBe('HLS · copy');
    expect(s.resolution).toBe('3840×2160');
    expect(s.videoCodec).toBe('HEVC 10-bit HDR');
    expect(s.audioFormat).toBe('EAC3 6.0 (fr)');
    expect(s.dropped).toBe('0 / 0');
  });

  it('labels the mode AAC when the audio is transcoded', () => {
    expect(buildWebStats(input({ aac: true })).mode).toBe('HLS · AAC');
  });

  it('reports Direct mode with no bitrate when not using HLS / no bytes', () => {
    const s = buildWebStats(input({ useHls: false, bytes: 0 }));
    expect(s.mode).toBe('Direct');
    expect(s.bitrate).toBeUndefined();
  });

  it('computes an average bitrate from bytes and duration', () => {
    // (1e9 bytes * 8) / 3600 s / 1e6 ≈ 2.22 Mb/s
    expect(buildWebStats(input()).bitrate).toBe('2.22 Mb/s');
  });

  it('computes buffer-ahead from bufEnd - cur (clamped at 0)', () => {
    expect(buildWebStats(input({ cur: 40, bufEnd: 100 })).buffer).toBe(
      'stats.bufferAhead({"seconds":"60.0"})',
    );
    expect(buildWebStats(input({ cur: 90, bufEnd: 50 })).buffer).toBe(
      'stats.bufferAhead({"seconds":"0.0"})',
    );
  });

  it('omits the resolution when there are no video dimensions', () => {
    const noDims = { ...item, video: null } as unknown as MovieView;
    expect(buildWebStats(input({ item: noDims })).resolution).toBeUndefined();
  });

  it('selects the audio track by index, falling back to the first', () => {
    expect(buildWebStats(input({ audioIndex: 1 })).audioFormat).toBe('AAC 2.0 (en)');
    expect(buildWebStats(input({ audioIndex: 99 })).audioFormat).toBe('EAC3 6.0 (fr)');
  });

  it('includes an anchor diagnostics row only for HLS', () => {
    const labels = (s: ReturnType<typeof buildWebStats>) => (s.extra ?? []).map((r) => r.label);
    expect(labels(buildWebStats(input({ useHls: true })))).toContain('stats.anchor');
    expect(labels(buildWebStats(input({ useHls: false })))).not.toContain('stats.anchor');
  });

  it('reports the container and default volume in the extra rows', () => {
    const rows = buildWebStats(input()).extra ?? [];
    expect(rows.find((r) => r.label === 'stats.container')?.value).toBe('MKV');
    expect(rows.find((r) => r.label === 'stats.volume')?.value).toBe('100%');
  });
});
