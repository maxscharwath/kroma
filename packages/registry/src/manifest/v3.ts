// Manifest v3: v2 plus `storage`.
//
// v3 exists rather than an edit to v2 because a module's database stopped being
// something every sidecar got for free. Under v2 a module was handed the whole
// core database ambiently; under v3 it declares what it touches, and a manifest
// that declares nothing gets nothing. Read against v2 that field parses as
// absent, which would read as "no storage" for a module that has some - the
// exact silent-misread a version bump exists to prevent.

import { z } from 'zod';
import { ArtifactRef, Manifest as V2 } from './v2.ts';

/** The version this file defines. */
const SCHEMA_VERSION = 3;

// A table (`downloads`) or one of its columns (`users.username`). Anything not
// listed is denied, so the spelling has to be exact.
const TableOrColumn = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/);

/** The slice of the SHARED core database a module may reach. */
export const CoreScope = z.object({
  read: z
    .array(TableOrColumn)
    .nullish()
    .describe(
      'Tables and columns this module may SELECT, as "table" or "table.column". A column named in a WHERE is reached as much as one that is projected.',
    ),
  write: z
    .array(TableOrColumn)
    .nullish()
    .describe(
      'Tables this module may INSERT / UPDATE / DELETE. A write grant is not a read grant, and a foreign key drags its other table in: writing a child reads the parent, and a cascading delete writes the child.',
    ),
});
export type CoreScope = z.infer<typeof CoreScope>;

/** A module's databases, and the capability itself. */
export const Storage = z.object({
  core: CoreScope.nullish().describe(
    "The slice of the shared core database this module may reach. Enforced per connection by SQLite's authorizer at prepare time, so it cannot be worked around by building the SQL as a string. Absent means none of it.",
  ),
  adopt: z
    .array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/))
    .nullish()
    .describe(
      "Tables this module used to keep in the core database and now owns. The core moves each one - schema, indexes and rows - into the module's own file before the module is spawned, then drops the core copy, so it happens exactly once.",
    ),
});
export type Storage = z.infer<typeof Storage>;

/** A module's `module.json`, as authored. */
export const Manifest = V2.extend({
  storage: Storage.nullish().describe(
    "This module's databases, and the capability itself: without a storage object the module gets no database and its binary does not link SQLite. Its presence alone grants it its own file at <data>/modules/<id>/module.sqlite, where its migrations run and which it owns outright.",
  ),
});
export type Manifest = z.infer<typeof Manifest>;

/** Whether a module was built against the manifest contract this build speaks.
 *  A bundle that was not is refused rather than read on a best-effort basis: the
 *  fields that moved between versions parse as ABSENT, not as errors, so a stale
 *  one would install with its dependencies silently dropped. */
export function speaksCurrentSchema(manifest: Pick<Manifest, 'schemaVersion'>): boolean {
  return manifest.schemaVersion === SCHEMA_VERSION;
}

const mapOf = (raw: Manifest['dependencies']): Record<string, string> => raw ?? {};

/** The versions a module requires, by id. */
export function dependenciesOf(manifest: Manifest): Record<string, string> {
  return mapOf(manifest.dependencies);
}

/** The versions a module suggests but does not require, by id. */
export function optionalDependenciesOf(manifest: Manifest): Record<string, string> {
  return mapOf(manifest.optionalDependencies);
}

/** The least a registry document can be built from: a manifest, an icon, and
 *  the builds it ships. */
export const DescribedModule = Manifest.extend({
  icon: z.string().nullish(),
  artifacts: z.array(ArtifactRef),
});
export type DescribedModule = z.infer<typeof DescribedModule>;
