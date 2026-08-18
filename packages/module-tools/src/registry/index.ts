export { buildDescriptor, buildIndex, buildModuleRecord, sriFromHex } from './build';
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
  ModuleRecord,
  REGISTRY_API_VERSION,
  RegistryArtifact,
  RegistryDescriptor,
  RegistryEntry,
  RegistryIndex,
  RegistryVersion,
} from './schema';
export { jsonSchema, SCHEMA_NAMES, type SchemaName } from './spec';
