// The catalog as the site consumes it. Parsed with zod at the trust boundary:
// the JSON crosses the network (or arrives injected by the worker), and one
// malformed third-party field must not blank the whole page.

import { z } from 'zod';

const DownloadUrl = z
  .string()
  .nullish()
  .transform((v) => (v?.startsWith('https://') ? v : null));

const Sha256 = z
  .string()
  .nullish()
  .transform((v) => (v && /^[0-9a-f]{64}$/i.test(v) ? v : null));

const Artifact = z.object({
  target: z.string().nullish(),
  size: z.number().nullish(),
  url: DownloadUrl,
  sha256: Sha256,
});

export const ModuleEntry = z.object({
  id: z.string(),
  name: z.string().default(''),
  version: z.string().default(''),
  description: z.string().nullish(),
  minServer: z.string().nullish(),
  library: z.boolean().nullish(),
  // Schema 2 emits a `{ id: range }` map; very old catalogs carried an array.
  dependsOn: z.union([z.record(z.string(), z.string()), z.array(z.string())]).nullish(),
  provides: z.array(z.object({ kind: z.string(), id: z.string() })).nullish(),
  icon: z.string().nullish(),
  artifacts: z.array(Artifact).nullish(),
  size: z.number().nullish(),
  url: DownloadUrl,
  sha256: Sha256,
});
export type ModuleEntry = z.infer<typeof ModuleEntry>;

export const Catalog = z.object({
  generatedAt: z.string().nullish(),
  modules: z.array(ModuleEntry).default([]),
  error: z.string().nullish(),
});
export type Catalog = z.infer<typeof Catalog>;
