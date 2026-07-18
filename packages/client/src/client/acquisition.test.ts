import { describe, expect, it } from 'vitest';
import type { SaveIndexerBody, SaveVpnBody } from '../types';
import type { RequestContext } from './base';
import {
  analyzeTorrent,
  manualSearch,
  pauseDownload,
  removeDownload,
  saveVpn,
  updateIndexer,
} from './acquisition';

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

describe('removeDownload', () => {
  it('adds ?deleteData=true only when requested', () => {
    const { ctx, calls } = recordCtx();
    void removeDownload(ctx, 'd1', { deleteData: true });
    void removeDownload(ctx, 'd2');
    expect(calls[0]).toMatchObject({
      path: '/admin/downloads/d1?deleteData=true',
      init: { method: 'DELETE' },
    });
    expect(calls[1]?.path).toBe('/admin/downloads/d2');
  });
});

describe('download / indexer verbs', () => {
  it('pauseDownload POSTs the encoded id', () => {
    const { ctx, calls } = recordCtx();
    void pauseDownload(ctx, 'd 1');
    expect(calls[0]).toMatchObject({
      path: '/admin/downloads/d%201/pause',
      init: { method: 'POST' },
    });
  });

  it('updateIndexer PUTs to the encoded id with its body', () => {
    const { ctx, calls } = recordCtx();
    const body = { name: 'Nyaa', url: 'http://x' } as unknown as SaveIndexerBody;
    void updateIndexer(ctx, 'i 1', body);
    expect(calls[0]).toMatchObject({ path: '/admin/indexers/i%201', init: { method: 'PUT' } });
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual(body);
  });
});

describe('acquisition bodies', () => {
  it('wraps the query and magnet in their POST bodies', () => {
    const { ctx, calls } = recordCtx();
    void manualSearch(ctx, 'dune 2021');
    void analyzeTorrent(ctx, 'magnet:?xt=urn:btih:abc');
    expect(calls[0]?.path).toBe('/admin/acquisition/search');
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({ query: 'dune 2021' });
    expect(JSON.parse(calls[1]?.init?.body as string)).toEqual({
      magnetOrUrl: 'magnet:?xt=urn:btih:abc',
    });
  });

  it('saveVpn PUTs the config body', () => {
    const { ctx, calls } = recordCtx();
    const body = { wgConfig: '[Interface]...' } as unknown as SaveVpnBody;
    void saveVpn(ctx, body);
    expect(calls[0]).toMatchObject({ path: '/admin/vpn', init: { method: 'PUT' } });
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual(body);
  });
});
