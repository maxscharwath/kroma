import { describe, expect, it } from 'vitest';
import type { RequestContext } from './base';
import { discoverDetail, discoverSearch, discoverTrending } from './discovery';

function recordCtx() {
  const calls: string[] = [];
  const ctx = {
    baseUrl: 'http://nas:4040',
    json: async (path: string) => {
      calls.push(path);
      return {} as never;
    },
  } as unknown as RequestContext;
  return { ctx, calls };
}

describe('discoverSearch', () => {
  it('encodes the query and adds type + page > 1', () => {
    const { ctx, calls } = recordCtx();
    void discoverSearch(ctx, 'star wars', { type: 'movie', page: 2 });
    expect(calls[0]).toBe('/discover/search?q=star+wars&type=movie&page=2');
  });

  it('omits the "all" type and page 1', () => {
    const { ctx, calls } = recordCtx();
    void discoverSearch(ctx, 'dune', { type: 'all', page: 1 });
    expect(calls[0]).toBe('/discover/search?q=dune');
  });

  it('works with no options', () => {
    const { ctx, calls } = recordCtx();
    void discoverSearch(ctx, 'a&b');
    expect(calls[0]).toBe('/discover/search?q=a%26b');
  });
});

describe('discoverTrending', () => {
  it('has no query string with no options', () => {
    const { ctx, calls } = recordCtx();
    void discoverTrending(ctx);
    expect(calls[0]).toBe('/discover/trending');
  });

  it('includes type and page when meaningful', () => {
    const { ctx, calls } = recordCtx();
    void discoverTrending(ctx, { type: 'tv', page: 3 });
    expect(calls[0]).toBe('/discover/trending?type=tv&page=3');
  });
});

describe('discoverDetail', () => {
  it('builds the kind/id path', () => {
    const { ctx, calls } = recordCtx();
    void discoverDetail(ctx, 'movie', 603);
    expect(calls[0]).toBe('/discover/movie/603');
  });
});
