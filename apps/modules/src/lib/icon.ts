import { type Env, loadCatalog } from '#site/lib/source';

const DATA_SVG = 'data:image/svg+xml;base64,';

/** Where a module's icon is served from, versioned so it can be cached forever:
 *  a module that changes its artwork changes its version with it. */
export function iconPath(id: string, version: string): string {
  return `/icon/${encodeURIComponent(id)}/${encodeURIComponent(version || '0')}.svg`;
}

/**
 * The icon as a URL rather than the data URI the catalog carries.
 *
 * A data URI is the right shape for `modules.json` - a KROMA server reads the
 * catalog once and wants the artwork in it - but the wrong shape for a page.
 * The page sends every icon twice, once in the markup and once again in the
 * dehydrated loader payload the client rehydrates from, so a 1.6 KB SVG costs
 * 3.2 KB per module and none of it can be cached separately.
 */
export function withIconUrls<T extends { id: string; version: string; icon?: string | null }>(
  modules: readonly T[],
): T[] {
  return modules.map((m) =>
    m.icon?.startsWith(DATA_SVG) ? { ...m, icon: iconPath(m.id, m.version) } : { ...m },
  );
}

const ICON_ROUTE = /^\/icon\/([^/]+)\/[^/]+\.svg$/;

/** Serves what `iconPath` points at, or null when the path is not one. */
export async function iconResponse(
  path: string,
  env: Env,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response | null> {
  const match = ICON_ROUTE.exec(path);
  if (!match?.[1]) return null;
  const id = decodeURIComponent(match[1]);

  const body = await loadCatalog(env, waitUntil);
  if (!body) return new Response('catalog unavailable', { status: 503 });

  const { Catalog } = await import('#site/catalog');
  const parsed = Catalog.safeParse(JSON.parse(body));
  const icon = parsed.success ? parsed.data.modules.find((m) => m.id === id)?.icon : null;
  if (!icon?.startsWith(DATA_SVG)) return new Response('no such icon', { status: 404 });

  return new Response(atob(icon.slice(DATA_SVG.length)), {
    headers: {
      'content-type': 'image/svg+xml',
      // The version is in the path, so this answer can never go stale.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
