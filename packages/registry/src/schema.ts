// The RFC-110 wire format, as zod schemas. A registry is hosted by anyone, so
// every document a client reads is untrusted input: these schemas are the trust
// boundary, and the inferred types are the only shape the rest of the code sees.

import { z } from 'zod';

/** The contract version every document carries. A client refuses what it does
 *  not know rather than half-reading it. */
export const REGISTRY_API_VERSION = 1;

// Subresource-Integrity form of a sha256 digest: `sha256-<base64>`.
const Integrity = z.string().regex(/^sha256-[A-Za-z0-9+/]{43}=$/, 'not an sha256 SRI');

const Capability = z.object({ kind: z.string(), id: z.string() });
const CapabilityReq = z.object({ kind: z.string(), id: z.string().nullish() });

export const RegistryArtifact = z.object({
  // `null` for a bundle that carries no native binary, so it runs anywhere.
  target: z.string().nullish(),
  url: z.string(),
  size: z.number().int().nonnegative(),
  integrity: Integrity,
  // sha256 of the uncompressed tar: the publisher's "did the bundle change?"
  // key, not something an installer verifies.
  contentHash: Integrity.nullish(),
});
export type RegistryArtifact = z.infer<typeof RegistryArtifact>;

const DependencyMap = z.record(z.string(), z.string());

/** Everything that is true of one *version* of a module. */
export const RegistryVersion = z.object({
  minServer: z.string().nullish(),
  library: z.boolean().nullish(),
  dependencies: DependencyMap.nullish(),
  optionalDependencies: DependencyMap.nullish(),
  provides: z.array(Capability).nullish(),
  requires: z.array(CapabilityReq).nullish(),
  artifacts: z.array(RegistryArtifact),
});
export type RegistryVersion = z.infer<typeof RegistryVersion>;

// Everything that is true of the module regardless of version: identity and
// the metadata a store page renders.
const ModuleMeta = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  author: z.string().nullish(),
  homepage: z.string().nullish(),
  license: z.string().nullish(),
  keywords: z.array(z.string()).nullish(),
  tags: z.array(z.string()).nullish(),
  icon: z.string().nullish(),
});

/** `GET /index.json`: one entry per module, carrying the version a bare install
 *  resolves to. Enough to render a store and judge compatibility in ONE request. */
export const RegistryEntry = ModuleMeta.extend(RegistryVersion.shape).extend({
  version: z.string(),
});
export type RegistryEntry = z.infer<typeof RegistryEntry>;

export const RegistryIndex = z.array(RegistryEntry);

/** `GET /m/{id}.json`: every version the registry serves, plus the named
 *  channels that point into them. */
export const ModuleRecord = ModuleMeta.extend({
  apiVersion: z.number().int().min(1),
  latest: z.string(),
  distTags: z.record(z.string(), z.string()).default({}),
  versions: z.record(z.string(), RegistryVersion),
});
export type ModuleRecord = z.infer<typeof ModuleRecord>;

/** `GET /registry.json`: who this registry is and which ids it serves. */
export const RegistryDescriptor = z.object({
  apiVersion: z.number().int().min(1),
  name: z.string(),
  url: z.string(),
  modules: z.array(z.string()),
});
export type RegistryDescriptor = z.infer<typeof RegistryDescriptor>;
