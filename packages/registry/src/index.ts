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
  Capability,
  CapabilityReq,
  DOCUMENT_SCHEMAS,
  Integrity,
  ModuleRecord,
  REGISTRY_API_VERSION,
  RegistryArtifact,
  RegistryDescriptor,
  RegistryEntry,
  RegistryIndex,
  RegistryVersion,
} from './documents';
export {
  ArtifactRef,
  ConfigField,
  DescribedModule,
  dependenciesOf,
  MANIFEST_SCHEMAS,
  Manifest,
  MODULE_SCHEMA_VERSION,
  optionalDependenciesOf,
  REVERSE_DNS_ID,
  speaksCurrentSchema,
} from './manifest';
export { channelOf, compareRaw, parse, satisfies, type Version } from './semver';
export {
  jsonSchema,
  publishesSchema,
  SCHEMA_NAMES,
  type SchemaName,
  schemaPath,
  schemaVersionOf,
} from './spec';
