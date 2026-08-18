// What a registry document is built FROM: a module's own `module.json`, the
// icon beside it, and the builds it ships. Schemas rather than interfaces
// because every one of these arrives as JSON from somewhere else - out of a
// downloaded `.kmod`'s tar, or off a published catalog - so the shape is
// checked, not asserted.

import { z } from 'zod';
import { Capability, CapabilityReq } from './schema';

// Any optional field may arrive as an explicit null.
const DependencyMap = z.record(z.string(), z.string()).nullish();

/** One admin-configurable setting a module exposes. */
export const ConfigField = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['string', 'bool', 'number', 'select']),
  default: z.string().nullish(),
  options: z.array(z.string()).nullish(),
  placeholder: z.string().nullish(),
  // Rendered as a password input, and the value is treated write-only.
  secret: z.boolean().nullish(),
  required: z.boolean().nullish(),
});
export type ConfigField = z.infer<typeof ConfigField>;

/** The manifest contract this build speaks. */
export const MODULE_API_VERSION = 2;

/** A module's `module.json`, as authored. */
export const Manifest = z.object({
  // Optional in the SHAPE, required by the contract. A catalog row is derived
  // from a bundle that may predate the field, and a registry that still lists
  // one should render rather than fail to parse - the refusal belongs where the
  // bundle is actually opened, which is `speaksCurrentApi` at install.
  apiVersion: z.number().int().nullish(),
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().nullish(),
  minServer: z.string().nullish(),
  library: z.boolean().nullish(),
  dependencies: DependencyMap,
  optionalDependencies: DependencyMap,
  provides: z.array(Capability).nullish(),
  requires: z.array(CapabilityReq).nullish(),
  /** Cross-module RPC contracts this module SERVES, by name. Distinct from
   *  `provides`: this is the machine wiring a consumer resolves against, so no
   *  one has to name a module id. */
  ports: z.array(z.string()).nullish(),
  permissions: z.array(z.string()).nullish(),
  config: z.array(ConfigField).nullish(),
  feRemote: z.object({ module: z.string() }).nullish(),
  // Store metadata, all optional.
  author: z.string().nullish(),
  homepage: z.string().nullish(),
  license: z.string().nullish(),
  keywords: z.array(z.string()).nullish(),
  tags: z.array(z.string()).nullish(),
});
export type Manifest = z.infer<typeof Manifest>;

/** Whether a module was built against the manifest contract this build speaks.
 *  A bundle that was not is refused rather than read on a best-effort basis: the
 *  fields that moved between versions parse as ABSENT, not as errors, so a stale
 *  one would install with its dependencies silently dropped. */
export function speaksCurrentApi(manifest: Pick<Manifest, 'apiVersion'>): boolean {
  return manifest.apiVersion === MODULE_API_VERSION;
}

const mapOf = (raw: Manifest['dependencies']): Record<string, string> => raw ?? {};

/** The versions a module requires, by id. */
export function dependenciesOf(manifest: Manifest): Record<string, string> {
  return mapOf(manifest.dependencies);
}

/** The versions a module suggests but does not require, by id. */
export function optionalDependenciesOf(manifest: Manifest): Record<string, string> {
  return mapOf(manifest.optionalDependencies);
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
