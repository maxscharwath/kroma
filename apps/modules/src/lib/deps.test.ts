import { describe, expect, it } from 'vitest';
import { ModuleEntry } from '#site/catalog';
import { depEntries } from './deps';

const entry = (over: Record<string, unknown>) =>
  ModuleEntry.parse({ id: 'tv.kroma.x', name: 'X', version: '1.0.0', ...over });

describe('depEntries', () => {
  it('reads the map a module declares', () => {
    const map = { 'tv.kroma.torrents': '^1.2.0', 'tv.kroma.vpn': '*' };
    expect(depEntries(entry({ dependencies: map }))).toEqual([
      { id: 'tv.kroma.torrents', range: '^1.2.0' },
      { id: 'tv.kroma.vpn', range: '*' },
    ]);
  });

  it('lists the bare-array form very old catalogs carried, with no range', () => {
    expect(depEntries(entry({ dependencies: ['tv.kroma.torrents'] }))).toEqual([
      { id: 'tv.kroma.torrents', range: null },
    ]);
  });

  it('is empty when there is nothing to show', () => {
    for (const deps of [undefined, null, {}, []]) {
      expect(depEntries(entry({ dependencies: deps }))).toEqual([]);
    }
  });
});
