import { workerContext } from '@kroma/site-kit/worker-env';
import { iconResponse } from '#site/lib/icon';
import { isRegistryPath, registryResponse } from '#site/lib/registry';
import { type Env, jsonResponse, loadCatalog, UNAVAILABLE } from '#site/lib/source';

export type ExecCtx = { waitUntil(p: Promise<unknown>): void };

/**
 * The registry endpoints: the RFC-110 documents, the legacy catalog a KROMA
 * server reads, the module icons, and the favicon.
 * Returns `null` when the request should fall through to the rendered site.
 *
 * The bare origin is itself a valid registry URL, so only `Accept: text/html`
 * gets a page there; anything else gets the descriptor, which is what a client
 * pasting the origin is looking for.
 */
export async function machineResponse(
  request: Request,
  env: Env | undefined,
  ctx: ExecCtx,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/(^|[^/])\/+$/, '$1') || '/';

  if (path === '/ping') return new Response('pong');
  // `/favicon.svg` is a static asset, which the platform answers before this
  // worker runs. `.ico` is only ever requested by a client that ignored the
  // `<link rel="icon">` in the page, so point it at the real file rather than
  // keeping a second copy of the mark inlined here to serve under a name that
  // is not its format.
  if (path === '/favicon.ico') {
    return Response.redirect(new URL('/favicon.svg', url), 301);
  }

  const isCatalog = path === '/modules.json' || path === '/all.json';
  const isIcon = path.startsWith('/icon/');
  const wantsHtml =
    request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html');
  // A machine at the bare origin is asking "what registry is this?", which is
  // the descriptor - the legacy catalog would answer with a shape a current
  // server no longer reads.
  const registryPath = path === '/' && !wantsHtml ? '/registry.json' : path;
  const isRegistry = isRegistryPath(registryPath);
  if (!isCatalog && !isIcon && !isRegistry) return null;

  // `vite dev` calls the server entry with no bindings at all.
  const resolved = env ?? ((await workerContext()).env as Env);
  if (isIcon) return iconResponse(path, resolved, (p) => ctx.waitUntil(p));
  if (isRegistry) {
    return registryResponse(registryPath, url.origin, resolved, (p) => ctx.waitUntil(p));
  }

  const catalog = await loadCatalog(resolved, (p) => ctx.waitUntil(p));
  return catalog ? jsonResponse(catalog, 300) : jsonResponse(UNAVAILABLE, 60);
}
