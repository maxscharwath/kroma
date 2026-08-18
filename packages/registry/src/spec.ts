// The wire format as JSON Schema, DERIVED from the zod schemas rather than
// hand-written beside them: a publisher in another language validates against
// the same definition this client parses with, and the two cannot drift.

import { z } from 'zod';
import { ModuleRecord, RegistryDescriptor, RegistryIndex } from './schema';

// zod strips unknown keys, which is right for a client reading a document it
// does not fully know. The PUBLISHED contract is open-world though: a registry
// may carry fields a later apiVersion defines, and a validator must not call
// that invalid.
function openWorld(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(openWorld);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'additionalProperties' && value === false) continue;
    out[key] = openWorld(value);
  }
  return out;
}

const DOCUMENTS = {
  registry: RegistryDescriptor,
  index: RegistryIndex,
  module: ModuleRecord,
} as const;

/** The document names a conforming registry serves a schema for. */
export type SchemaName = keyof typeof DOCUMENTS;

export const SCHEMA_NAMES = Object.keys(DOCUMENTS) as SchemaName[];

/** The JSON Schema (draft 2020-12) for one document of the wire format. */
export function jsonSchema(name: SchemaName): unknown {
  return openWorld(z.toJSONSchema(DOCUMENTS[name], { io: 'output' }));
}
