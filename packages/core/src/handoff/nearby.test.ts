// Merging what several ways of looking each found. The question this answers:
// one television, found twice, is one row, and it is the copy that can prove
// where it is.

import { describe, expect, it, vi } from 'vitest';
import { watchNearbyTvs } from './nearby';
import type { DiscoveredTv, TvDiscoverySource } from './sources';

function row(handle: string, name: string, via: 'lan' | 'server'): DiscoveredTv {
  return {
    handle,
    name,
    platform: 'tvOS',
    check: 'K7QM',
    via,
    ...(via === 'lan' ? { proof: `proof-${handle}` } : {}),
  };
}

// A source a test drives by hand, so a merge can be watched one report at a time.
function manual(id: string) {
  let publish: ((rows: DiscoveredTv[]) => void) | undefined;
  const stop = vi.fn();
  const source: TvDiscoverySource = {
    id,
    start(onRows) {
      publish = onRows;
      return stop;
    },
  };
  return { source, stop, report: (rows: DiscoveredTv[]) => publish?.(rows) };
}

describe('merging what each source found', () => {
  it('reports one row for a television found by both, keeping the heard copy', () => {
    const server = manual('server');
    const lan = manual('lan');
    const seen: DiscoveredTv[][] = [];
    watchNearbyTvs({ sources: [server.source, lan.source], onRows: (r) => seen.push(r) });

    server.report([row('h1', 'Salon', 'server')]);
    lan.report([row('h1', 'Salon', 'lan')]);

    const merged = seen.at(-1);
    expect(merged).toHaveLength(1);
    expect(merged?.[0]?.via).toBe('lan');
    expect(merged?.[0]?.proof).toBe('proof-h1');
  });

  it('keeps the heard copy whichever source reported first', () => {
    const lan = manual('lan');
    const server = manual('server');
    const seen: DiscoveredTv[][] = [];
    watchNearbyTvs({ sources: [lan.source, server.source], onRows: (r) => seen.push(r) });

    lan.report([row('h1', 'Salon', 'lan')]);
    server.report([row('h1', 'Salon', 'server')]);

    expect(seen.at(-1)?.[0]?.via).toBe('lan');
  });

  it('carries every television only one source could find', () => {
    const server = manual('server');
    const lan = manual('lan');
    const seen: DiscoveredTv[][] = [];
    watchNearbyTvs({ sources: [server.source, lan.source], onRows: (r) => seen.push(r) });

    server.report([row('h1', 'Salon', 'server')]);
    lan.report([row('h2', 'Chambre', 'lan')]);

    expect(seen.at(-1)?.map((r) => r.name)).toEqual(['Chambre', 'Salon']);
  });

  it('sorts by name so the list does not reshuffle under a thumb', () => {
    const server = manual('server');
    const seen: DiscoveredTv[][] = [];
    watchNearbyTvs({ sources: [server.source], onRows: (r) => seen.push(r) });

    server.report([
      row('h3', 'Salon', 'server'),
      row('h1', 'Bureau', 'server'),
      row('h2', 'Chambre', 'server'),
    ]);
    expect(seen.at(-1)?.map((r) => r.name)).toEqual(['Bureau', 'Chambre', 'Salon']);
  });

  it('breaks a tie on name by handle, so two TVs of one name hold their order', () => {
    const server = manual('server');
    const seen: DiscoveredTv[][] = [];
    watchNearbyTvs({ sources: [server.source], onRows: (r) => seen.push(r) });

    server.report([row('hb', 'Apple TV', 'server'), row('ha', 'Apple TV', 'server')]);
    expect(seen.at(-1)?.map((r) => r.handle)).toEqual(['ha', 'hb']);
  });

  it('leaves a quiet source s last view standing', () => {
    const server = manual('server');
    const lan = manual('lan');
    const seen: DiscoveredTv[][] = [];
    watchNearbyTvs({ sources: [server.source, lan.source], onRows: (r) => seen.push(r) });

    lan.report([row('h2', 'Chambre', 'lan')]);
    server.report([row('h1', 'Salon', 'server')]);
    // The link goes quiet; the server speaks again. Chambre is still there.
    server.report([row('h1', 'Salon', 'server'), row('h3', 'Bureau', 'server')]);

    expect(seen.at(-1)?.map((r) => r.name)).toEqual(['Bureau', 'Chambre', 'Salon']);
  });

  it('takes a source that empties as a source that found nothing', () => {
    const server = manual('server');
    const seen: DiscoveredTv[][] = [];
    watchNearbyTvs({ sources: [server.source], onRows: (r) => seen.push(r) });

    server.report([row('h1', 'Salon', 'server')]);
    server.report([]);
    expect(seen.at(-1)).toEqual([]);
  });
});

describe('standing down', () => {
  it('stops every source', () => {
    const server = manual('server');
    const lan = manual('lan');
    const stop = watchNearbyTvs({ sources: [server.source, lan.source], onRows: () => undefined });

    stop();
    expect(server.stop).toHaveBeenCalled();
    expect(lan.stop).toHaveBeenCalled();
  });

  it('reports nothing from a source that answers after the stop', () => {
    const server = manual('server');
    const seen: DiscoveredTv[][] = [];
    const stop = watchNearbyTvs({ sources: [server.source], onRows: (r) => seen.push(r) });

    stop();
    server.report([row('h1', 'Salon', 'server')]);
    expect(seen).toEqual([]);
  });

  it('reports nothing at all on a device with no way to look', () => {
    const seen: DiscoveredTv[][] = [];
    const stop = watchNearbyTvs({ sources: [], onRows: (r) => seen.push(r) });
    expect(seen).toEqual([]);
    expect(() => stop()).not.toThrow();
  });
});
