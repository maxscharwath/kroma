import { describe, expect, it } from 'vitest';
import { dependenciesOf, Manifest, optionalDependenciesOf, speaksCurrentSchema } from './v3.ts';

const base = { id: 'tv.kroma.x', name: 'X', version: '1.0.0' };

describe('storage', () => {
  it('is absent for a module that declares none, which is most of them', () => {
    // Absent is not the same as empty: it means no database at all, and a
    // sidecar built for it does not link SQLite.
    expect(Manifest.parse(base).storage).toBeUndefined();
  });

  it('reads an empty object as the module’s own file and nothing more', () => {
    const parsed = Manifest.parse({ ...base, storage: {} });
    expect(parsed.storage).toEqual({});
    expect(parsed.storage?.core).toBeUndefined();
  });

  it('keeps the core grant whole, table and column entries alike', () => {
    const parsed = Manifest.parse({
      ...base,
      storage: {
        core: { read: ['requests', 'users.username'], write: ['wanted'] },
        adopt: ['indexers'],
      },
    });
    // Dropping any of this would widen or silently void a module's grant.
    expect(parsed.storage).toEqual({
      core: { read: ['requests', 'users.username'], write: ['wanted'] },
      adopt: ['indexers'],
    });
  });

  it('refuses an entry that is not a table or one of its columns', () => {
    const bad = (read: string[]) => () => Manifest.parse({ ...base, storage: { core: { read } } });
    expect(bad(['users.name.first'])).toThrow();
    expect(bad(['requests; DROP TABLE users'])).toThrow();
    expect(bad(['*'])).toThrow();
    expect(bad([''])).toThrow();
    // ...and an adopted table is a bare name, never a column.
    expect(() => Manifest.parse({ ...base, storage: { adopt: ['users.id'] } })).toThrow();
  });

  it('accepts an explicit null for either half', () => {
    const parsed = Manifest.parse({ ...base, storage: { core: null, adopt: null } });
    expect(parsed.storage?.core).toBeNull();
  });
});

describe('speaksCurrentSchema', () => {
  it('accepts exactly this version and nothing either side of it', () => {
    // A bundle built for another contract is refused rather than read on a
    // best-effort basis: the fields that moved parse as ABSENT, not as errors,
    // so a v2 bundle would install with no storage and no dependencies.
    expect(speaksCurrentSchema({ schemaVersion: 3 })).toBe(true);
    expect(speaksCurrentSchema({ schemaVersion: 2 })).toBe(false);
    expect(speaksCurrentSchema({ schemaVersion: 4 })).toBe(false);
    expect(speaksCurrentSchema({ schemaVersion: null })).toBe(false);
    expect(speaksCurrentSchema({})).toBe(false);
  });
});

describe('the shape a real v3 manifest declares', () => {
  // Every property a manifest may carry. zod STRIPS what it does not declare,
  // so a field missing here is a field the published catalog would lose without
  // anything failing.
  const full = {
    schemaVersion: 3,
    id: 'tv.kroma.torrents',
    name: 'Torrents',
    version: '0.2.0',
    description: 'Downloads',
    engines: { server: '>=0.1.4' },
    library: false,
    dependencies: { 'tv.kroma.indexer': '^0.2.0' },
    optionalDependencies: { 'tv.kroma.vpn': '^0.2.0' },
    provides: [{ kind: 'download-client', id: 'rqbit', label: 'rqbit' }],
    requires: [{ kind: 'indexer-engine' }],
    ports: ['download-grab', 'download-db'],
    permissions: ['library.manage'],
    config: [{ key: 'host', label: 'Host', type: 'string', placeholder: 'localhost' }],
    feRemote: { module: './Module' },
    storage: {
      core: { read: ['downloads', 'requests'], write: ['downloads'] },
      adopt: ['download_clients'],
    },
  };

  it('keeps every one of them', () => {
    expect(Manifest.parse(full)).toEqual(full);
  });
});

describe('dependenciesOf / optionalDependenciesOf', () => {
  it('reads the map a module declares, and an absent one as none', () => {
    const m = Manifest.parse({
      ...base,
      dependencies: { 'tv.kroma.y': '^1.0.0' },
      optionalDependencies: { 'tv.kroma.z': '*' },
    });
    expect(dependenciesOf(m)).toEqual({ 'tv.kroma.y': '^1.0.0' });
    expect(optionalDependenciesOf(m)).toEqual({ 'tv.kroma.z': '*' });

    expect(dependenciesOf(Manifest.parse(base))).toEqual({});
    expect(optionalDependenciesOf(Manifest.parse(base))).toEqual({});
  });
});
