import { StyleSheet } from 'react-native';

type Fetch = (request: Request) => Response | Promise<Response>;

// react-native-web only, and it ships no TypeScript types.
type WebStyleSheet = { getSheet(): { id: string; textContent: string } };

/**
 * Puts the kit's compiled stylesheet in the document the server sends.
 *
 * react-native-web compiles a declaration into atomic CSS and injects it from
 * JavaScript on hydration, so a server-rendered page arrives with the right
 * class names and none of the rules: it paints unstyled, then snaps. Inlining
 * the sheet costs one string join and removes the flash entirely.
 *
 * The response is buffered rather than streamed, which is what makes this
 * correct: a recipe compiles on its first render, so the rules a page needs
 * exist only once that page has finished rendering — after `</head>` would
 * already have been flushed. The id is the one react-native-web looks for, so
 * the client adopts this element instead of starting a second sheet.
 */
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
