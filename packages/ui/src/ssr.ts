import { StyleSheet } from 'react-native';
import { readMode } from './core/theme-mode';

type Fetch = (request: Request) => Response | Promise<Response>;

// react-native-web only, and it ships no TypeScript types.
type WebStyleSheet = { getSheet(): { id: string; textContent: string } };

/**
 * Puts the kit's compiled stylesheet in the document the server sends.
 *
 * react-native-web compiles a declaration into atomic CSS and injects it from
 * JavaScript on hydration, so a server-rendered page arrives with the right
 * class names and none of the rules: it paints unstyled, then snaps.
 *
 * The response is buffered rather than streamed, which is what makes this
 * correct: a recipe compiles on its first render, so the rules a page needs
 * exist only once that page has finished rendering, which is after `</head>`
 * would already have been flushed.
 *
 * The id is the one react-native-web looks for, and the element has to carry
 * the whole sheet: on startup the client adopts it and rebuilds its record from
 * the rules it finds. An element it finds empty leaves it believing nothing is
 * registered, so it mints every rule again as it renders, and until that is
 * finished the page is laid out by a partial sheet that wins on order.
 */
/**
 * Stamps the visitor's stored ground on `<html>` before the document leaves the
 * server, so a page that will be light never paints dark first.
 *
 * Only an explicit choice is written. `system` is deliberately left unstamped:
 * the token sheet resolves it through `prefers-color-scheme`, which costs no
 * script and keeps following the operating system while the page is open.
 */
export function withTheme(handler: Fetch): Fetch {
  return async (request: Request) => {
    const response = await handler(request);
    if (!response.headers.get('content-type')?.includes('text/html')) return response;

    const mode = readMode(request.headers.get('cookie') ?? '');
    const html = await response.text();
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.append('vary', 'cookie');
    return new Response(
      mode === 'system' ? html : html.replace('<html', `<html data-theme="${mode}"`),
      { status: response.status, statusText: response.statusText, headers },
    );
  };
}

export function withKitStyles(handler: Fetch): Fetch {
  return async (request: Request) => {
    const response = await handler(request);
    if (!response.headers.get('content-type')?.includes('text/html')) return response;

    const html = await response.text();
    const sheet = (StyleSheet as unknown as WebStyleSheet).getSheet();
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(
      html.replace('</head>', `<style id="${sheet.id}">${sheet.textContent}</style></head>`),
      { status: response.status, statusText: response.statusText, headers },
    );
  };
}
