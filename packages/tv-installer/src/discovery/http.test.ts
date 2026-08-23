import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { fetchJson } from './http';

const System = z.object({ name: z.string() });
const url = 'http://192.168.1.34:1925/6/system';

const answering = (body: string, init?: ResponseInit) =>
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(body, init)));

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('parses a body the television answered and the schema accepts', async () => {
    answering('{"name":"55PUS7304/12"}');

    expect(await fetchJson(url, System)).toEqual({ name: '55PUS7304/12' });
  });

  it('answers nothing when the television refuses the request', async () => {
    answering('{"name":"55PUS7304/12"}', { status: 403 });

    expect(await fetchJson(url, System)).toBeNull();
  });

  it('answers nothing when the body is not the shape that was asked for', async () => {
    answering('{"name":42}');

    expect(await fetchJson(url, System)).toBeNull();
  });

  it('answers nothing when the body runs past the byte ceiling', async () => {
    answering(JSON.stringify({ name: 'x'.repeat(4096) }));

    expect(await fetchJson(url, System, { maxBytes: 512 })).toBeNull();
  });
});
