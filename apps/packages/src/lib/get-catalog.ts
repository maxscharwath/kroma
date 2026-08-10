import { createServerFn } from '@tanstack/react-start';
import { DEFAULT_REPO, loadCatalog } from '#site/lib/catalog';
import { type Release, toRelease } from '#site/lib/release';
import { workerContext } from '#site/lib/worker-env';

// The origin the page was actually served from, so a preview deploy, the
// workers.dev fallback and a self-hosted mirror each advertise themselves
// rather than the production hostname a NAS would then fail to reach.
//
// Imported inside the handler: this module is reachable from the route, and the
// server entry at module scope drags Node built-ins into the client graph.
async function sourceUrl(): Promise<string> {
  const { getRequest } = await import('@tanstack/react-start/server');
  return `${new URL(getRequest().url).origin}/`;
}

export const getCatalog = createServerFn().handler(async () => {
  const { env, waitUntil } = await workerContext();
  const source = await sourceUrl();
  try {
    const catalog = await loadCatalog(env, waitUntil);
    return {
      source,
      fetchedAt: catalog.fetchedAt,
      repo: catalog.repo,
      rows: catalog.entries.map(toRelease),
    };
  } catch (err) {
    console.error('catalog load failed', err);
    return {
      source,
      fetchedAt: null,
      repo: env.GITHUB_REPO || DEFAULT_REPO,
      rows: [] as Release[],
    };
  }
});
