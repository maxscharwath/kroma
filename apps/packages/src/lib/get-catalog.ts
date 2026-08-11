import { workerContext } from '@kroma/site-kit/worker-env';
import { createServerFn } from '@tanstack/react-start';
import { DEFAULT_REPO, loadCatalog } from '#site/lib/catalog';
import { type Release, toRelease } from '#site/lib/release';

export const getCatalog = createServerFn().handler(async () => {
  const { env, waitUntil } = await workerContext();
  // Imported here, not at module scope: the server entry drags Node built-ins
  // into the client graph of every route that reaches this module.
  const { getRequest } = await import('@tanstack/react-start/server');
  const source = `${new URL(getRequest().url).origin}/`;
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
