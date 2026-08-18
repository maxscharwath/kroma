// The packed-catalog shapes: what `readBundles` recovers from a `.kmod` and what
// the schema-2 `catalog.json` carries. The contract-level model it extends lives
// in `@kroma/registry`.

import type { ArtifactRef, DescribedModule } from '@kroma/registry';

/** One downloadable `.kmod` build, as the packer records it. */
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
