import { describe, expect, it } from 'vitest';
import { dependenciesOf, Manifest, optionalDependenciesOf } from './manifest';

const base = { id: 'tv.kroma.x', name: 'X', version: '1.0.0' };

describe('Manifest', () => {
  it('reads a manifest with nothing but the required fields', () => {
    expect(Manifest.parse(base)).toMatchObject(base);
  });

  it('refuses one that is missing an identity field', () => {
    expect(() => Manifest.parse({ id: 'tv.kroma.x', name: 'X' })).toThrow();
    expect(() => Manifest.parse({ ...base, version: 1 })).toThrow();
  });

  it('accepts an explicit null wherever a field is optional', () => {
    const parsed = Manifest.parse({ ...base, description: null, keywords: null, tags: null });
    expect(parsed.description).toBeNull();
  });

  it('carries a provider entry whole, admin UI metadata included', () => {
    const parsed = Manifest.parse({
      ...base,
      provides: [{ kind: 'download-client', id: 'qbittorrent', label: 'qBittorrent', fields: [] }],
    });
    // Stripping these would silently break the "add engine" picker.
    expect(parsed.provides?.[0]).toMatchObject({ label: 'qBittorrent', fields: [] });
  });

  it('refuses a capability that is not one', () => {
    expect(() => Manifest.parse({ ...base, provides: [{ id: 'no-kind' }] })).toThrow();
  });
});

describe('dependenciesOf / optionalDependenciesOf', () => {
  it('reads either spelling', () => {
    const current = Manifest.parse({ ...base, dependencies: { 'tv.kroma.y': '^1.0.0' } });
    const legacy = Manifest.parse({ ...base, dependsOn: { 'tv.kroma.y': '^1.0.0' } });
    expect(dependenciesOf(current)).toEqual({ 'tv.kroma.y': '^1.0.0' });
    expect(dependenciesOf(legacy)).toEqual({ 'tv.kroma.y': '^1.0.0' });
  });

  it('prefers the current spelling when a manifest carries both', () => {
    const both = Manifest.parse({
      ...base,
      dependencies: { a: '^1' },
      dependsOn: { b: '^2' },
    });
    expect(dependenciesOf(both)).toEqual({ a: '^1' });
  });

  it('reads the optional map under either name', () => {
    const current = Manifest.parse({ ...base, optionalDependencies: { z: '*' } });
    const legacy = Manifest.parse({ ...base, optionalDependsOn: { z: '*' } });
    expect(optionalDependenciesOf(current)).toEqual({ z: '*' });
    expect(optionalDependenciesOf(legacy)).toEqual({ z: '*' });
  });

  it('reads the empty-array form very old manifests use as no dependencies', () => {
    expect(dependenciesOf(Manifest.parse({ ...base, dependsOn: [] }))).toEqual({});
    expect(dependenciesOf(Manifest.parse(base))).toEqual({});
  });
});
