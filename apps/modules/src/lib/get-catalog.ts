import { workerContext } from '@kroma/site-kit/worker-env';
import { createServerFn } from '@tanstack/react-start';
import type { ModuleEntry } from '#site/catalog';
import { withIconUrls } from '#site/lib/icon';
import { loadCatalog } from '#site/lib/source';

/** What the browse pages render: the catalog read live from the upstream release,
 *  with `registry` the URL a KROMA server would add to reach this site. */
export async function catalogPayload(origin: string): Promise<{
  registry: string;
  modules: ModuleEntry[];
  generatedAt: string | null;
}> {
  // Imported here, not at module scope: zod would otherwise reach the client
  // bundle, which this module is also part of.
  const { parseCatalog } = await import('#site/catalog');
  const { env, waitUntil } = await workerContext();
  const registry = `${origin}/modules.json`;
  const body = await loadCatalog(env, waitUntil);
  const catalog = body ? parseCatalog(body) : null;
  if (!catalog) return { registry, modules: [], generatedAt: null };
  return {
    registry,
    modules: withIconUrls(catalog.modules),
    generatedAt: catalog.generatedAt ?? null,
  };
}

export const getCatalog = createServerFn().handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server');
  return catalogPayload(new URL(getRequest().url).origin);
});
