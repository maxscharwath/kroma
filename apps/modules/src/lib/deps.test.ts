import { describe, expect, it } from 'vitest';
import { ModuleEntry } from '#site/catalog';
import { depEntries } from './deps';

const entry = (over: Record<string, unknown>) =>
  ModuleEntry.parse({ id: 'tv.kroma.x', name: 'X', version: '1.0.0', ...over });

describe('depEntries', () => {
  it('reads the map under either spelling', () => {
    const rows = [
      { id: 'tv.kroma.torrents', range: '^1.2.0' },
      { id: 'tv.kroma.vpn', range: '*' },
    ];
    const map = { 'tv.kroma.torrents': '^1.2.0', 'tv.kroma.vpn': '*' };
    expect(depEntries(entry({ dependencies: map }))).toEqual(rows);
    expect(depEntries(entry({ dependsOn: map }))).toEqual(rows);
  });

  it('lists the bare-array form very old catalogs carried, with no range', () => {
    expect(depEntries(entry({ dependsOn: ['tv.kroma.torrents'] }))).toEqual([
      { id: 'tv.kroma.torrents', range: null },
    ]);
  });

  it('is empty when there is nothing to show', () => {
    for (const deps of [undefined, null, {}, []]) {
      expect(depEntries(entry({ dependsOn: deps }))).toEqual([]);
    }
  });
});
