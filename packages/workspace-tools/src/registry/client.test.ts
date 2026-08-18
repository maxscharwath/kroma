import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createRegistryClient,
  type ModuleRecord,
  pickVersion,
  type SearchEntry,
  verifyIntegrity,
} from './client';

describe('pickVersion', () => {
  it('returns the highest satisfying version', () => {
    expect(pickVersion(['0.1.0', '0.1.9', '0.2.0'], '^0.1.0')).toBe('0.1.9');
  });

  it('returns null when nothing satisfies', () => {
    expect(pickVersion(['0.1.0', '0.2.0'], '^0.3.0')).toBeNull();
  });
});

describe('verifyIntegrity', () => {
  const bytes = new TextEncoder().encode('hello');
  const good = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;

  it('accepts matching bytes', () => {
    expect(verifyIntegrity(bytes, good)).toBe(true);
  });

  it('rejects tampered bytes', () => {
    expect(verifyIntegrity(new TextEncoder().encode('hell0'), good)).toBe(false);
  });

  it('rejects a non-sha256 or malformed integrity', () => {
    expect(verifyIntegrity(bytes, 'md5-abc')).toBe(false);
    expect(verifyIntegrity(bytes, 'nonsense')).toBe(false);
  });
});

describe('createRegistryClient', () => {
  const record: ModuleRecord = {
    apiVersion: 1,
    id: 'tv.kroma.torrents',
    name: 'Torrents',
    latest: '0.1.9',
    distTags: { latest: '0.1.9', beta: '0.2.0-beta.1' },
    versions: {
      '0.1.0': { artifacts: [] },
      '0.1.9': { minServer: '0.1.4', artifacts: [] },
      '0.2.0-beta.1': { artifacts: [] },
    },
  };
  const index: SearchEntry[] = [
    { id: 'tv.kroma.torrents', name: 'Torrents', keywords: ['download'], latest: '0.1.9' },
    { id: 'tv.kroma.remote', name: 'Remote', tags: ['remote-access'], latest: '0.1.2' },
  ];
  const getJson = async (url: string) => {
    if (url.endsWith('/m/tv.kroma.torrents.json')) return record;
    if (url.endsWith('/search/index.json')) return index;
    throw new Error(`unexpected ${url}`);
  };
  const client = createRegistryClient('https://r/', getJson);

  it('resolves a range to the highest matching version', async () => {
    const out = await client.resolve('tv.kroma.torrents', '^0.1.0');
    expect(out?.version).toBe('0.1.9');
    expect(out?.record.minServer).toBe('0.1.4');
  });

  it('resolves to null when no version matches', async () => {
    expect(await client.resolve('tv.kroma.torrents', '^9.0.0')).toBeNull();
  });

  it('resolves a channel (dist-tag) to its version, incl. a pre-release', async () => {
    expect((await client.resolve('tv.kroma.torrents', 'beta'))?.version).toBe('0.2.0-beta.1');
    expect((await client.resolve('tv.kroma.torrents', 'latest'))?.version).toBe('0.1.9');
  });

  it('a stable range does not pick up the beta version', async () => {
    expect((await client.resolve('tv.kroma.torrents', '^0.1.0'))?.version).toBe('0.1.9');
  });

  it('searches the index by id, name, keyword or tag', async () => {
    expect((await client.search('download')).map((e) => e.id)).toEqual(['tv.kroma.torrents']);
    expect((await client.search('remote-access')).map((e) => e.id)).toEqual(['tv.kroma.remote']);
    expect(await client.search('')).toHaveLength(2);
  });
});
