import { createServerFn } from '@tanstack/react-start';
import type { VersionRow } from '#site/lib/history';
import { workerContext } from '#site/lib/worker-env';

export const getModuleHistory = createServerFn()
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<VersionRow[]> => {
    // Imported here rather than at module scope: the route reaches this file
    // from the browser too, and zod plus the GitHub reader belong to the
    // server alone.
    const { z } = await import('zod');
    const { moduleHistory } = await import('#site/lib/history');
    const id = z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,63}$/i)
      .safeParse(data.id);
    if (!id.success) return [];
    const { env, waitUntil } = await workerContext();
    return moduleHistory(env, waitUntil, id.data);
  });
