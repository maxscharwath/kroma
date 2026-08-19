// The parts of the manifest contract that do NOT move between versions.
//
// Each published version keeps its own schema, frozen, because the JSON Schema
// it serves stays at a pinned URL forever. These are not that: they read a
// field whose SHAPE is the same in every version, so a copy per version is a
// copy that can silently disagree with its siblings about what "no dependencies"
// means. A version that does change one of these stops importing it and defines
// its own, which is the same rule the schemas follow.

/** A manifest, seen only through the fields these helpers read. */
type WithDependencies = {
  dependencies?: Record<string, string> | null;
  optionalDependencies?: Record<string, string> | null;
};

/** The versions a module requires, by id. */
export function dependenciesOf(manifest: WithDependencies): Record<string, string> {
  return manifest.dependencies ?? {};
}

/** The versions a module suggests but does not require, by id. */
export function optionalDependenciesOf(manifest: WithDependencies): Record<string, string> {
  return manifest.optionalDependencies ?? {};
}

/** Whether a module was built against the manifest contract `version` speaks.
 *  A bundle that was not is refused rather than read on a best-effort basis: the
 *  fields that moved between versions parse as ABSENT, not as errors, so a stale
 *  one would install with its dependencies silently dropped. */
export function speaksSchema(version: number) {
  return (manifest: { schemaVersion?: number | null }): boolean =>
    manifest.schemaVersion === version;
}
