import { workerContext } from '@kroma/site-kit/worker-env';
import { createServerFn } from '@tanstack/react-start';
import type { ModuleEntry } from '#site/catalog';
import { withIconUrls } from '#site/lib/icon';
import { loadCatalog } from '#site/lib/source';

export const getCatalog = createServerFn().handler(async () => {
  // Imported here, not at module scope: zod and the server entry would otherwise
  // reach the client bundle, which this module is also part of.
  const { parseCatalog } = await import('#site/catalog');
  const { getRequest } = await import('@tanstack/react-start/server');
  const { env, waitUntil } = await workerContext();
  const registry = `${new URL(getRequest().url).origin}/modules.json`;
  const body = await loadCatalog(env, waitUntil);
  const catalog = body ? parseCatalog(body) : null;
  if (!catalog) return { registry, modules: [] as ModuleEntry[], generatedAt: null };
  return {
    registry,
    modules: withIconUrls(catalog.modules),
    generatedAt: catalog.generatedAt ?? null,
  };
});
