import { describe, expect, it } from 'vitest';
import { recordingClient } from '../../kroma-client.fixture';
import { ItemId } from './ids';

const item = ItemId.parse('i1');

const SPLASH = {
  kind: 'movie',
  title: 'Dune',
  year: 2021,
  backdropUrl: '/api/images/b.webp',
};

describe('splash', () => {
  it('resolves each art path against the server, like every other poster', async () => {
    const { client } = recordingClient(() => ({ json: [SPLASH] }));

    const entries = await client.media.splash();

    expect(entries[0]?.backdropUrl).toBe('http://kroma.test/api/images/b.webp');
  });

  it('leaves an absolute URL alone and keeps the rest of the entry', async () => {
    const absolute = { ...SPLASH, backdropUrl: 'https://image.tmdb.org/b.jpg' };
    const { client } = recordingClient(() => ({ json: [absolute] }));

    const entries = await client.media.splash();

    expect(entries[0]).toEqual(absolute);
  });

  it('answers an empty sample with an empty list', async () => {
    const { client } = recordingClient(() => ({ json: [] }));

    await expect(client.media.splash()).resolves.toEqual([]);
  });
});

describe('the HLS master URL', () => {
  const { client } = recordingClient();
  const url = (...args: Parameters<typeof client.media.hlsMasterUrl>) =>
    client.media.hlsMasterUrl(...args).replace('http://kroma.test/api', '');

  it('emits the copy program at anchor 0, audio 0', () => {
    expect(url(item)).toBe('/items/i1/hls/copy/0/0/index.m3u8');
  });

  it('emits the aac program for the AAC variant', () => {
    expect(url(item, true)).toBe('/items/i1/hls/aac/0/0/index.m3u8');
  });

  it('puts the anchor (rounded, clamped) and audio track in the path', () => {
    expect(url(item, false, 600.6, 2)).toBe('/items/i1/hls/copy/601/2/index.m3u8');
    expect(url(item, false, -5, -1)).toBe('/items/i1/hls/copy/0/0/index.m3u8');
  });

  it('makes a loudness filter the mode segment, which forces the transcode path', () => {
    expect(url(item, false, 0, 0, { filter: 'night' })).toBe(
      '/items/i1/hls/aac-night/0/0/index.m3u8',
    );
  });

  it('declares decodable codecs so the server can override an unplayable copy', () => {
    expect(url(item, false, 0, 0, { copyCodecs: ['aac', 'eac3'] })).toBe(
      '/items/i1/hls/copy/0/0/index.m3u8?copy=aac%2Ceac3',
    );
  });

  it('ignores declared audio codecs once the request already transcodes', () => {
    expect(url(item, true, 0, 0, { copyCodecs: ['aac'] })).toBe('/items/i1/hls/aac/0/0/index.m3u8');
  });

  it('declares decodable video, which the audio treatment never suppresses', () => {
    expect(url(item, true, 0, 0, { videoCodecs: ['h264'] })).toBe(
      '/items/i1/hls/aac/0/0/index.m3u8?video=h264',
    );
  });

  it('declares both axes of the decoder ceiling, which the server fits inside', () => {
    expect(url(item, false, 0, 0, { maxFrame: { width: 1920, height: 1080 } })).toBe(
      '/items/i1/hls/copy/0/0/index.m3u8?maxw=1920&maxh=1080',
    );
  });

  it('declares no ceiling for a device that never probed one', () => {
    expect(url(item, false, 0, 0, { maxFrame: { width: 0, height: 0 } })).toBe(
      '/items/i1/hls/copy/0/0/index.m3u8',
    );
  });
});

describe('logs', () => {
  it('returns the log body on success', async () => {
    const { client } = recordingClient(() => ({ text: 'line one\nline two' }));

    await expect(client.media.logs()).resolves.toBe('line one\nline two');
  });

  it('throws on a non-ok response', async () => {
    const { client } = recordingClient(() => ({ ok: false, status: 503 }));

    await expect(client.media.logs()).rejects.toMatchObject({ status: 503 });
  });
});

describe('storyboard', () => {
  const manifest = {
    url: '/api/sb.jpg',
    interval: 10,
    tileW: 160,
    tileH: 90,
    cols: 5,
    rows: 5,
    count: 25,
    duration: 250,
  };

  it('maps 202 to pending, a non-ok to null, and 200 to the manifest', async () => {
    const pending = recordingClient(() => ({ status: 202 })).client;
    const missing = recordingClient(() => ({ ok: false, status: 404 })).client;
    const ready = recordingClient(() => ({ json: manifest })).client;

    await expect(pending.media.storyboard(item)).resolves.toBe('pending');
    await expect(missing.media.storyboard(item)).resolves.toBeNull();
    await expect(ready.media.storyboard(item)).resolves.toEqual(manifest);
  });
});
