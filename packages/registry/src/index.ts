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
  type Searchable,
  verifyIntegrity,
} from './client';
export {
  ArtifactRef,
  DescribedModule,
  dependenciesOf,
  Manifest,
  optionalDependenciesOf,
} from './manifest';
export {
  Capability,
  CapabilityReq,
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
