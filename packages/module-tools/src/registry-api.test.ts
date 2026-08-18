import { describe, expect, it } from 'vitest';
import type { Entry } from './bundles';
import { buildDescriptor, buildModuleRecord, buildSearchIndex, sriFromHex } from './registry-api';

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id: 'tv.kroma.torrents',
    name: 'Torrents',
    version: '0.1.7',
    description: 'Torrent stuff',
    minServer: '0.1.4',
    icon: 'data:image/svg+xml,…',
    provides: [{ kind: 'download-client', id: 'builtin' }],
    artifacts: [
      {
        target: 'x86_64-linux',
        file: 'x.kmod',
        url: 'https://h/x.kmod',
        size: 10,
        sha256: 'ab',
        contentHash: 'cd',
      },
    ],
    file: 'x.kmod',
    url: 'https://h/x.kmod',
    size: 10,
    sha256: 'ab',
    ...over,
  } as Entry;
}

describe('sriFromHex', () => {
  it('encodes a hex digest as sha256-<base64>', () => {
    // 0xdeadbeef → base64 of those 4 bytes
    expect(sriFromHex('deadbeef')).toBe('sha256-3q2+7w==');
  });
});

describe('buildModuleRecord', () => {
  it('carries the store metadata and one version with SRI artifacts', () => {
    const record = buildModuleRecord(
      entry({ author: 'Max', license: 'GPL-2.0-or-later', keywords: ['torrent'] }),
    );
    expect(record).toMatchObject({
      apiVersion: 1,
      id: 'tv.kroma.torrents',
      author: 'Max',
      license: 'GPL-2.0-or-later',
      keywords: ['torrent'],
      latest: '0.1.7',
    });
    const version = record.versions['0.1.7'];
    expect(version?.minServer).toBe('0.1.4');
    expect(version?.artifacts[0]?.integrity).toBe(sriFromHex('ab'));
  });

  it('derives tags from provided capability kinds when none are explicit', () => {
    expect(buildModuleRecord(entry()).tags).toEqual(['download-client']);
  });

  it('tags a stable version as latest and a pre-release by its channel', () => {
    expect(buildModuleRecord(entry()).distTags).toEqual({ latest: '0.1.7' });
    expect(buildModuleRecord(entry({ version: '0.2.0-beta.3' })).distTags).toEqual({
      beta: '0.2.0-beta.3',
    });
  });

  it('prefers explicit tags over derived ones', () => {
    expect(buildModuleRecord(entry({ tags: ['featured'] })).tags).toEqual(['featured']);
  });

  it('reads dependencies under either the v2 or legacy key', () => {
    const v2 = buildModuleRecord(entry({ dependencies: { 'tv.kroma.x': '^0.1.0' } }));
    const legacy = buildModuleRecord(entry({ dependsOn: { 'tv.kroma.x': '^0.1.0' } }));
    expect(v2.versions['0.1.7']?.dependencies).toEqual({ 'tv.kroma.x': '^0.1.0' });
    expect(legacy.versions['0.1.7']?.dependencies).toEqual({ 'tv.kroma.x': '^0.1.0' });
  });
});

describe('buildDescriptor / buildSearchIndex', () => {
  const modules = [entry({ id: 'tv.kroma.b' }), entry({ id: 'tv.kroma.a' })];

  it('descriptor lists sorted ids with the api version', () => {
    expect(buildDescriptor('KROMA', 'https://r', modules)).toEqual({
      apiVersion: 1,
      name: 'KROMA',
      url: 'https://r',
      modules: ['tv.kroma.a', 'tv.kroma.b'],
    });
  });

  it('search index is trimmed (no artifacts/versions) and sorted', () => {
    const index = buildSearchIndex(modules);
    expect(index.map((e) => e.id)).toEqual(['tv.kroma.a', 'tv.kroma.b']);
    expect(index[0]).not.toHaveProperty('artifacts');
    expect(index[0]).not.toHaveProperty('versions');
  });
});
