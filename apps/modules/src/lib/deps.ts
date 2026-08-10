import type { ModuleEntry } from '#site/catalog';

/** Schema 2 emits a `{ id: range }` map; very old catalogs carried an array. */
export function depList(deps: ModuleEntry['dependsOn']): string[] {
  if (Array.isArray(deps)) return deps;
  return deps ? Object.keys(deps) : [];
}
