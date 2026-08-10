import { createServerFn } from '@tanstack/react-start';
import type { ModuleEntry } from '#site/catalog';
import { loadCatalog } from '#site/lib/source';
import { workerContext } from '#site/lib/worker-env';

// The origin the page was actually served from, so a preview deploy, the
// workers.dev fallback and a self-hosted mirror each advertise themselves
// rather than the production hostname.
//
// Imported inside the handler: this module is reachable from the route, and the
// server entry at module scope drags Node built-ins into the client graph.
async function registryUrl(): Promise<string> {
  const { getRequest } = await import('@tanstack/react-start/server');
  return `${new URL(getRequest().url).origin}/modules.json`;
}

export const getCatalog = createServerFn().handler(async () => {
  // Imported here rather than at module scope: the schema is only ever parsed on
  // the server, and a top-level import puts zod in the client bundle too.
  const { Catalog } = await import('#site/catalog');
  const { env, waitUntil } = await workerContext();
  const registry = await registryUrl();
  const body = await loadCatalog(env, waitUntil);
  const empty = { registry, modules: [] as ModuleEntry[], generatedAt: null };
  if (!body) return empty;
  const parsed = Catalog.safeParse(JSON.parse(body));
  if (!parsed.success) return empty;
  return {
    registry,
    modules: parsed.data.modules,
    generatedAt: parsed.data.generatedAt ?? null,
  };
});
