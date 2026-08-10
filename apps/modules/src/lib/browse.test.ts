import { describe, expect, it } from 'vitest';
import type { ModuleEntry } from '../catalog';
import { matchesQuery, pageOf, sliceLabel } from './browse';

const entry = (id: string, name = '', description = ''): ModuleEntry => ({
  id,
  name,
  version: '0.1.0',
  description,
  url: null,
  sha256: null,
});

describe('matchesQuery', () => {
  it('matches on the name, the id and the description, case-insensitively', () => {
    const m = entry('tv.kroma.vpn', 'VPN', 'Routes the download engine through a tunnel.');
    expect(matchesQuery(m, 'vpn')).toBe(true);
    expect(matchesQuery(m, 'KROMA.VPN')).toBe(true);
    expect(matchesQuery(m, 'tunnel')).toBe(true);
    expect(matchesQuery(m, 'whisper')).toBe(false);
  });

  it('keeps everything for an empty or blank query', () => {
    expect(matchesQuery(entry('tv.kroma.vpn'), '')).toBe(true);
    expect(matchesQuery(entry('tv.kroma.vpn'), '   ')).toBe(true);
  });
});

describe('pageOf', () => {
  const items = [1, 2, 3, 4, 5];

  it('slices the page and reports the visible range', () => {
    expect(pageOf(items, 1, 2)).toMatchObject({ items: [1, 2], first: 1, last: 2, pageCount: 3 });
    expect(pageOf(items, 3, 2)).toMatchObject({ items: [5], first: 5, last: 5, page: 3 });
  });

  it('clamps a page that no longer exists rather than showing nothing', () => {
    expect(pageOf(items, 9, 2)).toMatchObject({ items: [5], page: 3 });
    expect(pageOf(items, 0, 2)).toMatchObject({ items: [1, 2], page: 1 });
  });

  it('reports an empty list as one empty page', () => {
    expect(pageOf([], 1, 2)).toEqual({ items: [], page: 1, pageCount: 1, first: 0, last: 0 });
  });
});

describe('sliceLabel', () => {
  it('names the range only when the page is not the whole set', () => {
    expect(sliceLabel({ first: 1, last: 8, total: 12 })).toBe('1-8 of 12 modules');
    expect(sliceLabel({ first: 9, last: 12, total: 12 })).toBe('9-12 of 12 modules');
    expect(sliceLabel({ first: 1, last: 3, total: 3 })).toBe('3 modules');
    expect(sliceLabel({ first: 1, last: 1, total: 1 })).toBe('1 module');
  });
});
