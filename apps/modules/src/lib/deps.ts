import { dependenciesOf } from '@kroma/registry';
import type { ModuleEntry } from '#site/catalog';

export interface Dependency {
  id: string;
  range: string | null;
}

/** A module's required dependencies as rows. Very old catalogs carried a bare
 *  array of ids, which the shared reader treats as none; listed here without a
 *  range so the page still shows them. */
export function depEntries(m: ModuleEntry): Dependency[] {
  const raw = m.dependencies ?? m.dependsOn;
  if (Array.isArray(raw)) return raw.map((id) => ({ id, range: null }));
  return Object.entries(dependenciesOf(m)).map(([id, range]) => ({ id, range }));
}
