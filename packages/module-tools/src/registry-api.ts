// Build the RFC-110 registry artifacts from the catalog entries: the descriptor
// + id index (`registry.json`), one record per module (`m/{id}.json`), and a
// trimmed search index (`search/index.json`). Pure — entries in, JSON-able values
// out — so the shapes are unit-tested without touching disk.

import { dependenciesOf, type Entry } from './bundles';
import { byCodeUnit } from './sort';

export const REGISTRY_API_VERSION = 1;

export interface RegistryDescriptor {
  apiVersion: number;
  name: string;
  url: string;
  modules: string[];
}

export interface RegistryArtifact {
  target: string | null;
  url: string;
  size: number;
  integrity: string; // sha256-<base64>, SRI form
  contentHash: string; // sha256 of the uncompressed tar (the "did it change?" key)
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
  description?: string;
  author?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  tags?: string[];
  icon?: string;
  latest: string;
  distTags: Record<string, string>;
  versions: Record<string, RegistryVersion>;
}

// The channel a version belongs to: its first pre-release identifier (beta, rc,
// nightly…), or `latest` for a stable release.
export function channelOf(version: string): string {
  return version.match(/-([0-9A-Za-z]+)/)?.[1] ?? 'latest';
}

export interface SearchEntry {
  id: string;
  name: string;
  description?: string;
  keywords?: string[];
  tags?: string[];
  latest: string;
}

// A hex sha256 (what the packer records) as a Subresource-Integrity string.
export function sriFromHex(hexSha256: string): string {
  return `sha256-${Buffer.from(hexSha256, 'hex').toString('base64')}`;
}

// A module's tags: explicit manifest tags, else the capability kinds it provides
// (so a store can filter by "download-client" without hand-authored tags).
function tagsOf(entry: Entry): string[] | undefined {
  if (entry.tags && entry.tags.length > 0) return entry.tags;
  const kinds = (entry.provides ?? [])
    .map((p) => (p && typeof p === 'object' ? (p as { kind?: string }).kind : undefined))
    .filter((k): k is string => typeof k === 'string');
  const unique = [...new Set(kinds)];
  return unique.length > 0 ? unique : undefined;
}

export function buildModuleRecord(entry: Entry): ModuleRecord {
  const deps = dependenciesOf(entry);
  const version: RegistryVersion = {
    minServer: entry.minServer,
    dependencies: Object.keys(deps).length > 0 ? deps : undefined,
    provides: entry.provides,
    requires: entry.requires,
    artifacts: entry.artifacts.map((a) => ({
      target: a.target,
      url: a.url,
      size: a.size,
      integrity: sriFromHex(a.sha256),
      contentHash: sriFromHex(a.contentHash),
    })),
  };
  return {
    apiVersion: REGISTRY_API_VERSION,
    id: entry.id,
    name: entry.name,
    description: entry.description,
    author: entry.author,
    homepage: entry.homepage,
    license: entry.license,
    keywords: entry.keywords,
    tags: tagsOf(entry),
    icon: entry.icon,
    latest: entry.version,
    distTags: { [channelOf(entry.version)]: entry.version },
    versions: { [entry.version]: version },
  };
}

export function buildDescriptor(name: string, url: string, entries: Entry[]): RegistryDescriptor {
  return {
    apiVersion: REGISTRY_API_VERSION,
    name,
    url,
    modules: entries.map((e) => e.id).sort(),
  };
}

export function buildSearchIndex(entries: Entry[]): SearchEntry[] {
  return entries
    .map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      keywords: e.keywords,
      tags: tagsOf(e),
      latest: e.version,
    }))
    .sort((a, b) => byCodeUnit(a.id, b.id));
}
