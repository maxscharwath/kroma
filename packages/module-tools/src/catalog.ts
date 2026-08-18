// The catalog data model, kept free of node:fs/node:crypto so the registry
// builders below it can also run inside a Cloudflare worker.

/** A module's `module.json`, as authored. */
export interface Manifest {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  minServer?: string | null;
  library?: boolean | null;
  // RFC 110 names (npm-aligned). `dependsOn`/`optionalDependsOn` are the pre-v2
  // spelling and stay accepted; the readers below take either.
  dependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  dependsOn?: DependencyMap;
  optionalDependsOn?: DependencyMap;
  provides?: unknown[] | null;
  requires?: unknown[] | null;
  // Store metadata (RFC 110), all optional.
  author?: string | null;
  homepage?: string | null;
  license?: string | null;
  keywords?: string[] | null;
  tags?: string[] | null;
}

// A catalog is JSON from a host nobody controls: every optional field may
// arrive as an explicit null, and very old manifests spell the map as an array.
type DependencyMap = Record<string, string> | unknown[] | null;

// Either spelling, and `{}` for the empty-array form some manifests use.
function mapOf(raw: DependencyMap | undefined): Record<string, string> {
  return raw && !Array.isArray(raw) ? (raw as Record<string, string>) : {};
}

/** The required dependency map under either the v2 name or the legacy one. */
export function dependenciesOf(manifest: Manifest): Record<string, string> {
  return mapOf(manifest.dependencies ?? manifest.dependsOn);
}

/** The optional dependency map under either the v2 name or the legacy one. */
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

/** One downloadable `.kmod` build of a module, as the packer records it. */
export interface Artifact extends ArtifactRef {
  target: string | null;
  file: string;
  url: string;
  size: number;
  sha256: string;
  // sha256 of the UNCOMPRESSED tar. The pipeline's "did this module actually
  // change?" test, and the reason it is not `sha256`: that one covers the zstd
  // stream, so a compressor upgrade would move it while the bundle's contents
  // stood still, and every module would look like it needed a version bump.
  contentHash: string;
}

/** The least a registry document can be built from: a manifest, an icon, and
 *  the builds it ships. [`Entry`] is this plus the schema-1 mirror, which only
 *  the publish pipeline reads. */
export interface DescribedModule extends Manifest {
  icon?: string | null;
  artifacts: ArtifactRef[];
}

/** One module in the catalog: its manifest, its icon and every build of it. */
export interface Entry extends DescribedModule {
  icon?: string;
  artifacts: Artifact[];
  // Schema-1 compatibility mirror of artifacts[0].
  file: string;
  url: string;
  size: number;
  sha256: string;
}

export interface Catalog {
  schema: number;
  generatedAt?: string;
  modules: Entry[];
}
