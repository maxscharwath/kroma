import { KROMA_MARK_SVG } from '#site/lib/brand';
import { type Env, jsonResponse, loadCatalog, UNAVAILABLE } from '#site/lib/source';

export type ExecCtx = { waitUntil(p: Promise<unknown>): void };

/**
 * The registry endpoints: the catalog a KROMA server reads, and the favicon.
 * Returns `null` when the request should fall through to the rendered site.
 *
 * The BARE ORIGIN is a valid registry URL, so a non-browser GET of `/` has to
 * answer with the catalog rather than a page - that is what a server handed the
 * site URL follows. Only `Accept: text/html` gets rendered.
 */
export async function machineResponse(
  request: Request,
  env: Env,
  ctx: ExecCtx,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/(^|[^/])\/+$/, '$1') || '/';

  if (path === '/ping') return new Response('pong');
  if (path === '/favicon.svg' || path === '/favicon.ico') {
    return new Response(KROMA_MARK_SVG, {
      headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' },
    });
  }

  const isCatalog = path === '/modules.json' || path === '/all.json';
  const wantsHtml =
    request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html');
  if (!isCatalog && !(path === '/' && !wantsHtml)) return null;

  const catalog = await loadCatalog(env, (p) => ctx.waitUntil(p));
  return catalog ? jsonResponse(catalog, 300) : jsonResponse(UNAVAILABLE, 60);
}
