import { workerContext } from '@kroma/site-kit/worker-env';
import { createServerFn } from '@tanstack/react-start';
import type { VersionRow } from '#site/lib/history';

/** Which version of `id` every recent release shipped, or nothing at all when
 *  `id` is not a module id. */
export async function moduleVersions(id: string): Promise<VersionRow[]> {
  // Imported here, not at module scope: the route reaches this file from the
  // browser too, and zod plus the GitHub reader belong to the server alone.
  const { z } = await import('zod');
  const { moduleHistory } = await import('#site/lib/history');
  const parsed = z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]{1,63}$/i)
    .safeParse(id);
  if (!parsed.success) return [];
  const { env, waitUntil } = await workerContext();
  return moduleHistory(env, waitUntil, parsed.data);
}

export const getModuleHistory = createServerFn()
  .validator((data: { id: string }) => data)
  .handler(({ data }): Promise<VersionRow[]> => moduleVersions(data.id));
