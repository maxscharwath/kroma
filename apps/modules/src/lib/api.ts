import { KROMA_MARK_SVG } from '#site/lib/brand';
import { iconResponse } from '#site/lib/icon';
import { type Env, jsonResponse, loadCatalog, UNAVAILABLE } from '#site/lib/source';
import { workerContext } from '#site/lib/worker-env';

export type ExecCtx = { waitUntil(p: Promise<unknown>): void };

// `vite dev` calls the server entry with no bindings at all, so the argument is
// only trustworthy on workerd. Off it the ambient environment is the process's,
// which is the same rule `workerContext` already answers for the render path.
async function bindings(env: Env | undefined): Promise<Env> {
  return env ?? ((await workerContext()).env as Env);
}

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
  env: Env | undefined,
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
  const isIcon = path.startsWith('/icon/');
  const wantsHtml =
    request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html');
  if (!isCatalog && !isIcon && !(path === '/' && !wantsHtml)) return null;

  const resolved = await bindings(env);
  if (isIcon) return iconResponse(path, resolved, (p) => ctx.waitUntil(p));

  const catalog = await loadCatalog(resolved, (p) => ctx.waitUntil(p));
  return catalog ? jsonResponse(catalog, 300) : jsonResponse(UNAVAILABLE, 60);
}
