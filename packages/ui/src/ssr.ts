import { StyleSheet } from 'react-native';

type Fetch = (request: Request) => Response | Promise<Response>;

// react-native-web only, and it ships no TypeScript types.
type WebStyleSheet = { getSheet(): { id: string; textContent: string } };

/** The stylesheet a build wrote next to the page: where it is served from, and
 *  the rules it holds. */
export interface KitSheetFile {
  href: string;
  css: string;
}

// Rewritten in the built output by kitSheet() (@kroma/bundler), once the build
// has rendered the site and knows what the linked file holds.
const BUILT: KitSheetFile = { href: '__KROMA_KIT_SHEET_HREF__', css: '__KROMA_KIT_SHEET_CSS__' };

const GROUP = '[stylesheet-group=';
const CLASS = /\.((?:css|r)-[\w-]+)/gi;
const ATTR = /class="([^"]*)"/g;

function wornBy(html: string): Set<string> {
  const worn = new Set<string>();
  for (const match of html.matchAll(ATTR)) {
    for (const name of (match[1] ?? '').split(' ')) worn.add(name);
  }
  return worn;
}

// react-native-web compiles and inserts every rule of every style object it
// touches, then picks the class names that win; the losers are in the sheet and
// on no element. So a rule earns its place only if the page is wearing one of
// its classes. A rule that names none (the resets, the keyframes) always does.
function needed(rule: string, worn: ReadonlySet<string>): boolean {
  let named = false;
  for (const match of rule.matchAll(CLASS)) {
    named = true;
    if (worn.has(match[1] as string)) return true;
  }
  return !named;
}

// The element is adopted on startup and react-native-web rebuilds its record
// from it, rule by rule: every rule it reads has to sit under the group marker
// it belongs to, or the group lookup has nothing to push onto. So the marker
// above a rule that stays comes along with it.
function remainder(live: string, held: ReadonlySet<string>, worn: ReadonlySet<string>): string {
  const out: string[] = [];
  let marker: string | undefined;
  for (const rule of live.split('\n')) {
    if (rule.startsWith(GROUP)) {
      marker = rule;
      continue;
    }
    if (held.has(rule) || !needed(rule, worn)) continue;
    if (marker !== undefined) {
      out.push(marker);
      marker = undefined;
    }
    out.push(rule);
  }
  return out.join('\n');
}

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
 * A build that ran `kitSheet()` has rendered every page already and written
 * those rules to a hashed file, which is linked here rather than re-sent on
 * every response. What stays inline is only what this page is wearing and the
 * file does not hold, normally nothing at all; `x-kroma-kit-delta` reports that
 * remainder in bytes, so a variant no build ever rendered still paints and is
 * still visible. Without such a file, every rule is inlined as before.
 *
 * The id is the one react-native-web looks for, so the client adopts this
 * element instead of starting a second sheet, and it stays last in the head,
 * after the file, so the rules the browser compiles on its own keep winning
 * ties. What is inlined is a sheet in its own right, group markers and all,
 * because adoption re-reads it rule by rule.
 */
export function withKitStyles(handler: Fetch, file: KitSheetFile = BUILT): Fetch {
  const href = file.href.startsWith('/') ? file.href : null;
  const known = new Set(file.css.split('\n'));

  return async (request: Request) => {
    const response = await handler(request);
    if (!response.headers.get('content-type')?.includes('text/html')) return response;

    const html = await response.text();
    const sheet = (StyleSheet as unknown as WebStyleSheet).getSheet();
    const rest =
      href === null ? sheet.textContent : remainder(sheet.textContent, known, wornBy(html));
    if (href !== null && rest.length > 0) {
      console.warn(
        `kit sheet: ${new URL(request.url).pathname} inlined ${rest.length} bytes the built sheet does not hold`,
      );
    }

    const link = href === null ? '' : `<link rel="stylesheet" href="${href}">`;
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('x-kroma-kit-delta', String(rest.length));
    return new Response(
      html.replace('</head>', `${link}<style id="${sheet.id}">${rest}</style></head>`),
      { status: response.status, statusText: response.statusText, headers },
    );
  };
}
