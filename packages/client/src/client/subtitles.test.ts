import { describe, expect, it } from 'vitest';
import type { RequestContext } from './base';
import {
  cancelGeneration,
  deleteSubtitle,
  downloadedSubtitles,
  GEN_LANGS,
  GEN_QUALITIES,
  generateSubtitle,
  subtitleCapabilities,
  subtitleGenerations,
} from './subtitles';

function recordCtx() {
  const calls: { path: string; init?: RequestInit }[] = [];
  const ctx = {
    baseUrl: 'http://nas',
    json: async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      return {} as never;
    },
  } as unknown as RequestContext;
  return { ctx, calls };
}

describe('subtitle endpoint URLs', () => {
  it('encodes the item id in the capabilities/downloaded/generations paths', () => {
    const { ctx, calls } = recordCtx();
    void subtitleCapabilities(ctx, 'a b');
    void subtitleGenerations(ctx, 'a b');
    void downloadedSubtitles(ctx, 'a b');
    expect(calls.map((c) => c.path)).toEqual([
      '/items/a%20b/subtitles/capabilities',
      '/items/a%20b/subtitles/generations',
      '/items/a%20b/subtitles/downloaded',
    ]);
  });

  it('cancels and deletes with an encoded id + DELETE method', () => {
    const { ctx, calls } = recordCtx();
    void cancelGeneration(ctx, 'itm', 'gen/1');
    void deleteSubtitle(ctx, 'itm', 'dl 2');
    expect(calls[0]).toMatchObject({
      path: '/items/itm/subtitles/generations/gen%2F1',
      init: { method: 'DELETE' },
    });
    expect(calls[1]).toMatchObject({
      path: '/items/itm/subtitles/downloaded/dl%202',
      init: { method: 'DELETE' },
    });
  });
});

describe('generateSubtitle', () => {
  it('POSTs the request as a JSON body', () => {
    const { ctx, calls } = recordCtx();
    const req = { mode: 'transcribe' as const, lang: 'Français', quality: 'balanced' as const };
    void generateSubtitle(ctx, 'itm', req);
    expect(calls[0]?.path).toBe('/items/itm/subtitles/generate');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual(req);
  });
});

describe('generate sheet constants', () => {
  it('offers a stable, non-empty language + quality set', () => {
    expect(GEN_QUALITIES).toEqual(['fast', 'balanced', 'accurate']);
    const codes = GEN_LANGS.map((l) => l.code);
    expect(codes).toContain('fr');
    expect(codes).toContain('en');
    expect(new Set(codes).size).toBe(codes.length); // unique
    expect(GEN_LANGS.every((l) => l.code && l.label)).toBe(true);
  });
});
