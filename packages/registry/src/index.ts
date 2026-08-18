export {
  buildDescriptor,
  buildIndex,
  buildModuleRecord,
  type KnownVersions,
  sriFromHex,
} from './build';
export {
  createRegistryClient,
  type FetchJson,
  matches,
  pickVersion,
  type RegistryClient,
  type Resolved,
  verifyIntegrity,
} from './client';
export {
  type ArtifactRef,
  type DescribedModule,
  dependenciesOf,
  type Manifest,
  optionalDependenciesOf,
} from './manifest';
export {
  ModuleRecord,
  REGISTRY_API_VERSION,
  RegistryArtifact,
  RegistryDescriptor,
  RegistryEntry,
  RegistryIndex,
  RegistryVersion,
} from './schema';
export { channelOf, compareRaw, parse, satisfies, type Version } from './semver';
export { jsonSchema, SCHEMA_NAMES, type SchemaName } from './spec';
