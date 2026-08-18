// What a registry document is built FROM: a module's own `module.json`, the
// icon beside it, and the builds it ships. Schemas rather than interfaces
// because every one of these arrives as JSON from somewhere else - out of a
// downloaded `.kmod`'s tar, or off a published catalog - so the shape is
// checked, not asserted.

import { z } from 'zod';
import { Capability, CapabilityReq } from './schema';

// Very old manifests spell the map as an array, and any optional field may
// arrive as an explicit null.
const DependencyMap = z.union([z.record(z.string(), z.string()), z.array(z.unknown())]).nullish();

/** A module's `module.json`, as authored. */
export const Manifest = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().nullish(),
  minServer: z.string().nullish(),
  library: z.boolean().nullish(),
  // npm's spelling. `dependsOn`/`optionalDependsOn` are the pre-v2 names and
  // stay accepted; the readers below take either.
  dependencies: DependencyMap,
  optionalDependencies: DependencyMap,
  dependsOn: DependencyMap,
  optionalDependsOn: DependencyMap,
  provides: z.array(Capability).nullish(),
  requires: z.array(CapabilityReq).nullish(),
  // Store metadata, all optional.
  author: z.string().nullish(),
  homepage: z.string().nullish(),
  license: z.string().nullish(),
  keywords: z.array(z.string()).nullish(),
  tags: z.array(z.string()).nullish(),
});
export type Manifest = z.infer<typeof Manifest>;

function mapOf(raw: Manifest['dependencies']): Record<string, string> {
  return raw && !Array.isArray(raw) ? raw : {};
}

/** The required dependency map under either the current name or the legacy one. */
export function dependenciesOf(manifest: Manifest): Record<string, string> {
  return mapOf(manifest.dependencies ?? manifest.dependsOn);
}

/** The optional dependency map under either the current name or the legacy one. */
export function optionalDependenciesOf(manifest: Manifest): Record<string, string> {
  return mapOf(manifest.optionalDependencies ?? manifest.optionalDependsOn);
}

/** What a registry document says about one downloadable build. */
export const ArtifactRef = z.object({
  target: z.string().nullish(),
  url: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string().nullish(),
  contentHash: z.string().nullish(),
});
export type ArtifactRef = z.infer<typeof ArtifactRef>;

/** The least a registry document can be built from: a manifest, an icon, and
 *  the builds it ships. */
export const DescribedModule = Manifest.extend({
  icon: z.string().nullish(),
  artifacts: z.array(ArtifactRef),
});
export type DescribedModule = z.infer<typeof DescribedModule>;
