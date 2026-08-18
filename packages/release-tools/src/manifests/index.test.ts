import { describe, expect, it } from 'vitest';
import { cargoUpdater, jsonUpdater, updaterFor } from './index';

const cargo = '[package]\nname = "kroma-server"\nversion = "0.1.38"\nedition = "2021"\n';
const pkg = '{\n  "name": "@kroma/tizen",\n  "version": "0.1.38",\n  "private": true\n}\n';
const mod =
  '{\n  "id": "tv.kroma.acquisition",\n  "version": "0.1.8",\n  "minServer": "0.1.4"\n}\n';

describe('updaterFor', () => {
  it('picks by extension and throws on the unknown', () => {
    expect(updaterFor('server/Cargo.toml')).toBe(cargoUpdater);
    expect(updaterFor('clients/tizen/package.json')).toBe(jsonUpdater);
    expect(updaterFor('modules/x/module.json')).toBe(jsonUpdater);
    expect(() => updaterFor('setup.py')).toThrow();
  });
});

describe('cargoUpdater', () => {
  it('reads the package version, not a dependency version', () => {
    expect(cargoUpdater.read(`${cargo}\n[dependencies]\naxum = "0.7.0"\n`)).toBe('0.1.38');
  });

  it('rewrites only the package version and preserves the rest', () => {
    const out = cargoUpdater.write(cargo, '0.1.39');
    expect(out).toContain('version = "0.1.39"');
    expect(out).toContain('name = "kroma-server"');
  });
});

describe('jsonUpdater', () => {
  it('reads and writes package.json and module.json alike', () => {
    expect(jsonUpdater.read(pkg)).toBe('0.1.38');
    expect(jsonUpdater.read(mod)).toBe('0.1.8');
    expect(jsonUpdater.read(jsonUpdater.write(pkg, '0.2.0'))).toBe('0.2.0');
  });

  it('leaves other fields untouched when bumping a module', () => {
    expect(jsonUpdater.write(mod, '0.1.9')).toContain('"minServer": "0.1.4"');
  });
});

describe('updaterFor', () => {
  it('rejects an unknown extension', () => {
    expect(() => updaterFor('Cargo.lock')).toThrow(/no manifest updater/);
  });

  it('matches on the extension, not the file name', () => {
    expect(updaterFor('a/b/module.json')).toBe(jsonUpdater);
    expect(updaterFor('a/b/Cargo.toml')).toBe(cargoUpdater);
  });
});
