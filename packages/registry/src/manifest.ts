// What a registry document says about a module, independent of how it was
// packed. Kept free of node built-ins so the same builders run in a worker.

/** A module's `module.json`, as authored. */
export interface Manifest {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  minServer?: string | null;
  library?: boolean | null;
  // npm's spelling. `dependsOn`/`optionalDependsOn` are the pre-v2 names and
  // stay accepted; the readers below take either.
  dependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  dependsOn?: DependencyMap;
  optionalDependsOn?: DependencyMap;
  provides?: unknown[] | null;
  requires?: unknown[] | null;
  // Store metadata, all optional.
  author?: string | null;
  homepage?: string | null;
  license?: string | null;
  keywords?: string[] | null;
  tags?: string[] | null;
}

// A catalog is JSON from a host nobody controls: every optional field may
// arrive as an explicit null, and very old manifests spell the map as an array.
type DependencyMap = Record<string, string> | unknown[] | null;

function mapOf(raw: DependencyMap | undefined): Record<string, string> {
  return raw && !Array.isArray(raw) ? (raw as Record<string, string>) : {};
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
export interface ArtifactRef {
  target?: string | null;
  url: string;
  size: number;
  sha256?: string | null;
  contentHash?: string | null;
}

/** The least a registry document can be built from: a manifest, an icon, and
 *  the builds it ships. */
export interface DescribedModule extends Manifest {
  icon?: string | null;
  artifacts: ArtifactRef[];
}
