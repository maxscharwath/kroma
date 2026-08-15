import { describe, expect, it } from 'vitest';
import { catalogDay, ordered, type RawCatalog, resolveBlurb, toSiteCatalog } from './modules.ts';

const raw = (modules: RawCatalog['modules'], generatedAt?: string | null): RawCatalog => ({
  generatedAt,
  modules,
});

describe('toSiteCatalog', () => {
  it('reduces an entry to the facts the site renders', () => {
    const { modules } = toSiteCatalog(
      raw([
        {
          id: 'tv.kroma.torrents',
          name: 'Torrent downloads',
          version: '0.1.7',
          description: 'The engine',
          icon: 'data:image/svg+xml;base64,AAA',
          provides: [{ kind: 'download-client' }],
          requires: [],
          dependsOn: { 'tv.kroma.indexer': '^0.1.0' },
        },
      ]),
    );

    expect(modules[0]).toEqual({
      id: 'tv.kroma.torrents',
      name: 'Torrent downloads',
      version: '0.1.7',
      description: 'The engine',
      icon: 'data:image/svg+xml;base64,AAA',
      library: false,
      provides: ['download-client'],
      requires: [],
      dependsOn: ['tv.kroma.indexer'],
    });
  });

  it('accepts dependsOn as an array as well as a map', () => {
    const { modules } = toSiteCatalog(raw([{ id: 'a', dependsOn: ['x', 'y'] }]));
    expect(modules[0]?.dependsOn).toEqual(['x', 'y']);
  });

  it('falls back to the id when a name is missing, and never returns undefined fields', () => {
    const { modules } = toSiteCatalog(raw([{ id: 'tv.kroma.mystery' }]));
    expect(modules[0]).toMatchObject({
      name: 'tv.kroma.mystery',
      version: '',
      description: null,
      icon: null,
      library: false,
      provides: [],
      requires: [],
      dependsOn: [],
    });
  });

  it('marks a library module, which runs no process of its own', () => {
    const { modules } = toSiteCatalog(raw([{ id: 'tv.kroma.scene', library: true }]));
    expect(modules[0]?.library).toBe(true);
  });

  it('de-duplicates repeated capability kinds', () => {
    const { modules } = toSiteCatalog(
      raw([{ id: 'a', provides: [{ kind: 'indexer-engine' }, { kind: 'indexer-engine' }] }]),
    );
    expect(modules[0]?.provides).toEqual(['indexer-engine']);
  });

  it('carries a missing generatedAt through as null rather than undefined', () => {
    expect(toSiteCatalog(raw([])).generatedAt).toBeNull();
  });
});

describe('ordered', () => {
  it('tells the acquisition story in order, whatever order the catalog arrived in', () => {
    const { modules } = toSiteCatalog(
      raw([
        { id: 'tv.kroma.vpn' },
        { id: 'tv.kroma.indexer' },
        { id: 'tv.kroma.torrents' },
        { id: 'tv.kroma.acquisition' },
      ]),
    );

    expect(ordered(modules).map((x) => x.id)).toEqual([
      'tv.kroma.indexer',
      'tv.kroma.torrents',
      'tv.kroma.acquisition',
      'tv.kroma.vpn',
    ]);
  });

  it('keeps an unknown module rather than dropping it, after the curated ones', () => {
    const { modules } = toSiteCatalog(raw([{ id: 'tv.kroma.zzz' }, { id: 'tv.kroma.indexer' }]));
    expect(ordered(modules).map((x) => x.id)).toEqual(['tv.kroma.indexer', 'tv.kroma.zzz']);
  });

  it('does not mutate its input', () => {
    const { modules } = toSiteCatalog(raw([{ id: 'tv.kroma.vpn' }, { id: 'tv.kroma.indexer' }]));
    const before = modules.map((x) => x.id);
    ordered(modules);
    expect(modules.map((x) => x.id)).toEqual(before);
  });
});

describe('resolveBlurb', () => {
  const blurbs = { 'tv.kroma.whisper': () => 'Transcription, on your box' };

  it('prefers the site copy over the catalog description', () => {
    expect(resolveBlurb(blurbs, { id: 'tv.kroma.whisper', description: 'English from JSON' })).toBe(
      'Transcription, on your box',
    );
  });

  it('falls back to the catalog for a module the site has no copy for yet', () => {
    expect(resolveBlurb(blurbs, { id: 'tv.kroma.future', description: 'Brand new' })).toBe(
      'Brand new',
    );
  });

  it('renders nothing rather than "null" when neither exists', () => {
    expect(resolveBlurb(blurbs, { id: 'tv.kroma.future', description: null })).toBe('');
  });
});

describe('catalogDay', () => {
  it('keeps the day and drops the clock', () => {
    expect(catalogDay('2026-08-15T13:19:46.343Z')).toBe('2026-08-15');
  });

  it('answers null for an absent or unparseable stamp', () => {
    expect(catalogDay(null)).toBeNull();
    expect(catalogDay('last tuesday')).toBeNull();
  });
});
