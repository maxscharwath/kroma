// Public API. Import these to analyse any workspace: build a graph, find the
// projects a change affects (transitively), and verify the dependency edges.

export { affected, directlyChanged } from './core/affected';
export { byName, dependents, type Graph, type Project } from './core/graph';
export { compare, parse, type SemVer, satisfies } from './core/range';
export { type Violation, type ViolationKind, verify } from './core/verify';
export { changedFiles, type Exec } from './io/git';
export { loadGraph } from './io/load';
export {
  createRegistryClient,
  type ModuleRecord,
  pickVersion,
  type RegistryArtifact,
  type RegistryClient,
  type RegistryDescriptor,
  type RegistryVersion,
  type SearchEntry,
  verifyIntegrity,
} from './registry/client';
export { type Registries, registryFor } from './registry/routing';
export { type DependencySource, type DependencySpec, parseDependency } from './registry/spec';
