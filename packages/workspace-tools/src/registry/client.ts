import { createHash } from 'node:crypto';
import { compare, parse, satisfies } from '../core/range';

// A typed client for the RFC-110 registry wire format. HTTP access is injected
// (a `getJson`), so resolution, version selection and integrity are testable
// without a network, and the same client works against any conforming registry.

export interface RegistryArtifact {
  target: string | null;
  url: string;
  size: number;
  integrity: string; // sha256-<base64>
  contentHash?: string;
}

export interface RegistryVersion {
  minServer?: string;
  dependencies?: Record<string, string>;
  provides?: unknown[];
  requires?: unknown[];
  artifacts: RegistryArtifact[];
}

export interface ModuleRecord {
  apiVersion: number;
  id: string;
  name: string;
  latest: string;
  versions: Record<string, RegistryVersion>;
  [extra: string]: unknown;
}

export interface RegistryDescriptor {
  apiVersion: number;
  name: string;
  url: string;
  modules: string[];
}

export interface SearchEntry {
  id: string;
  name: string;
  description?: string;
  keywords?: string[];
  tags?: string[];
  latest: string;
}

export type GetJson = (url: string) => Promise<unknown>;

// The highest version that satisfies the range, or null. Pure.
export function pickVersion(versions: string[], range: string): string | null {
  const ok = versions.filter((v) => satisfies(v, range));
  ok.sort((a, b) => {
    const pa = parse(a);
    const pb = parse(b);
    if (!pa || !pb) return 0;
    return compare(pb, pa); // descending
  });
  return ok[0] ?? null;
}

// Verify bytes against an `sha256-<base64>` integrity string. Pure.
export function verifyIntegrity(bytes: Uint8Array, integrity: string): boolean {
  const [algo, expected] = integrity.split('-', 2);
  if (algo !== 'sha256' || !expected) return false;
  const actual = createHash('sha256').update(bytes).digest('base64');
  return actual === expected;
}

function matches(entry: SearchEntry, query: string): boolean {
  const q = query.toLowerCase();
  const hay = [
    entry.id,
    entry.name,
    entry.description ?? '',
    ...(entry.keywords ?? []),
    ...(entry.tags ?? []),
  ];
  return hay.some((field) => field.toLowerCase().includes(q));
}

export interface RegistryClient {
  descriptor(): Promise<RegistryDescriptor>;
  module(id: string): Promise<ModuleRecord>;
  search(query: string): Promise<SearchEntry[]>;
  resolve(id: string, range: string): Promise<{ version: string; record: RegistryVersion } | null>;
}

export function createRegistryClient(baseUrl: string, getJson: GetJson): RegistryClient {
  const base = baseUrl.replace(/\/$/, '');
  return {
    descriptor: () => getJson(`${base}/registry.json`) as Promise<RegistryDescriptor>,
    module: (id) => getJson(`${base}/m/${id}.json`) as Promise<ModuleRecord>,
    async search(query) {
      const index = (await getJson(`${base}/search/index.json`)) as SearchEntry[];
      return query ? index.filter((entry) => matches(entry, query)) : index;
    },
    async resolve(id, range) {
      const record = (await getJson(`${base}/m/${id}.json`)) as ModuleRecord;
      const version = pickVersion(Object.keys(record.versions), range);
      if (!version) return null;
      const resolved = record.versions[version];
      return resolved ? { version, record: resolved } : null;
    },
  };
}
