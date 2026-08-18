// The wire shape published by the backend at GET /api/modules. Mirrors the Rust
// `kroma_module_sdk::ModuleManifest` (serialized camelCase). The frontend reads
// this to learn which backend modules are active and to reconcile them against
// the frontend modules registered in the host.

/** One capability a backend module provides. `kind`+`id` are the interface and
 *  implementation; engine capabilities (download-client, indexer-engine) may also
 *  carry UI metadata so the admin's add-picker is data-driven. */
export interface Capability {
  kind: string;
  id: string;
  label?: string;
  fields?: ConfigField[];
  flow?: string;
}

/** A map of module id to semver range; a bare `"*"` means any version. Ranges
 *  are enforced on the backend, so the frontend registry reads only the id, for
 *  setup ordering. */
export type Dependencies = Record<string, string>;

/** A capability dependency: satisfied by any module whose `provides` matches. */
export interface CapabilityReq {
  kind: string;
  id?: string;
}

/** One admin-configurable setting a module exposes. */
export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'bool' | 'number' | 'select';
  default?: string;
  options?: string[];
  placeholder?: string;
  // Render as a password input; the value is treated write-only.
  secret?: boolean;
  required?: boolean;
}

/** The frontend remote a runtime-loaded module ships (Module Federation). The
 *  entry URL is derived by the host as `/modules/<id>/remoteEntry.js`. */
export interface FeRemote {
  module: string;
}

/** A backend module's self-description. */
export interface ModuleManifest {
  /** The manifest contract it was built against; a server speaking another one
   *  refuses the bundle rather than reading it on a best-effort basis. */
  apiVersion: number;
  id: string;
  name: string;
  version: string;
  description?: string;
  minServer?: string;
  dependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  requires?: CapabilityReq[];
  provides?: Capability[];
  permissions?: string[];
  config?: ConfigField[];
  feRemote?: FeRemote;
  enabled?: boolean;
}
