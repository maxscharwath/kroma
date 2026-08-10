import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'lightningcss';
import type { Plugin } from 'vite';

const HREF_SLOT = '__KROMA_KIT_SHEET_HREF__';
const CSS_SLOT = '__KROMA_KIT_SHEET_CSS__';

const SHEET = /<style id="react-native-stylesheet">([\s\S]*?)<\/style>/;
const ANCHOR = /<a\s[^>]*?href="(\/[^"]*)"/g;
const OPAQUE = /\.(?:json|png|jpg|svg|ico|css|js|txt|xml|webmanifest|zip|kmod|spk)($|\?)/;
const MARKER = '[stylesheet-group=';
const CLASS = /\.((?:css|r)-[\w-]+)/gi;
const ATTR = /class="([^"]*)"/g;

interface Handler {
  fetch(request: Request, env: unknown, ctx: unknown): Response | Promise<Response>;
}

export interface KitSheetOptions {
  /** Where the crawl starts. Every same-origin link it finds is rendered too. */
  entries?: string[];
  /** Hard cap on the pages rendered, so a paginated site cannot run away. */
  limit?: number;
  /** The bindings the worker is handed while the build renders it. */
  env?: Record<string, string>;
}

export interface KitSheetBuild extends KitSheetOptions {
  /** The written server bundle, and the entry file inside it to render. */
  serverDir: string;
  entry: string;
  /** Where the file is written; `base` is what the page will link it under. */
  clientDir: string;
  base?: string;
}

function ask(url: string): Request {
  return new Request(url, { headers: { accept: 'text/html,application/xhtml+xml' } });
}

async function render(handler: Handler, url: string, env: unknown, ctx: unknown) {
  let response = await handler.fetch(ask(url), env, ctx);
  for (let hop = 0; hop < 4 && response.status >= 300 && response.status < 400; hop += 1) {
    const location = response.headers.get('location');
    if (location === null) break;
    response = await handler.fetch(ask(new URL(location, url).href), env, ctx);
  }
  return response;
}

async function warm(entry: string, options: Required<KitSheetOptions>) {
  const loaded = (await import(pathToFileURL(entry).href)) as { default: Handler };
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => {},
  };

  const origin = 'https://kit-sheet.localhost';
  const queue = [...options.entries];
  const seen = new Set(queue);
  const rendered: string[] = [];
  const worn = new Set<string>();
  let css = '';

  while (queue.length > 0 && rendered.length < options.limit) {
    const path = queue.shift();
    if (path === undefined) break;
    const response = await render(loaded.default, origin + path, options.env, ctx);
    if (!response.headers.get('content-type')?.includes('text/html')) continue;
    const html = await response.text();
    rendered.push(path);
    const found = SHEET.exec(html)?.[1] ?? '';
    if (found.length > css.length) css = found;
    for (const match of html.matchAll(ATTR)) {
      for (const name of (match[1] ?? '').split(' ')) worn.add(name);
    }
    for (const match of html.matchAll(ANCHOR)) {
      const next = (match[1] ?? '').split('#')[0] ?? '';
      if (next === '' || seen.has(next) || OPAQUE.test(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  await Promise.allSettled(pending);
  return { css, rendered, worn };
}

async function scripts(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await scripts(path)));
    else if (entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}

async function fill(dir: string, values: Record<string, string>): Promise<Record<string, number>> {
  const hits: Record<string, number> = {};
  for (const slot of Object.keys(values)) hits[slot] = 0;
  for (const file of await scripts(dir)) {
    const source = await readFile(file, 'utf8');
    let next = source;
    for (const [slot, value] of Object.entries(values)) {
      next = next.replace(new RegExp(`(['"\`])${slot}\\1`, 'g'), () => {
        hits[slot] = (hits[slot] ?? 0) + 1;
        return JSON.stringify(value);
      });
    }
    if (next !== source) await writeFile(file, next);
  }
  return hits;
}

const classesIn = (css: string) => new Set([...css.matchAll(CLASS)].map((match) => match[1]));

// react-native-web compiles and inserts every rule of every style object it
// touches, then picks the class names that win; on these two sites a third of
// the sheet is losers, on no element of any page. A rule earns its place in the
// file only if a render wore one of its classes, and the runtime holds the same
// line: anything left out that a page does turn out to wear is inlined there.
function wornRules(css: string, worn: ReadonlySet<string>): string[] {
  return css.split('\n').filter((rule) => {
    if (rule.startsWith(MARKER)) return true;
    const names = classesIn(rule);
    return names.size === 0 || [...names].some((name) => worn.has(name as string));
  });
}

// The file is paint, not a record: react-native-web adopts the inline element,
// never this one, and re-inserts the rules it needs verbatim as it renders. So
// the group markers are dead weight here and the declarations can be squeezed,
// as long as every class still has somewhere to paint from.
function squeeze(css: string): string {
  const body = css
    .split('\n')
    .filter((rule) => !rule.startsWith(MARKER))
    .join('\n');
  const { code } = transform({
    filename: 'kit.css',
    code: new TextEncoder().encode(body),
    minify: true,
  });
  const out = new TextDecoder().decode(code);
  const lost = [...classesIn(body)].filter((name) => !classesIn(out).has(name));
  if (lost.length > 0) throw new Error(`kit sheet: minifying dropped ${lost.join(', ')}`);
  return out;
}

/**
 * Renders a written server bundle, writes the rules those renders actually
 * wore to `<clientDir>/assets/kit-<hash>.css`, and fills the two slots
 * `withKitStyles` holds for that file's path and its rules. Returns the file
 * name, the sheet at each stage and the pages the crawl reached.
 *
 * The file is minified; the slot keeps the same rules as react-native-web
 * spells them, because that text is what the runtime subtracts the live sheet
 * from before it inlines what is left.
 */
export async function writeKitSheet(build: KitSheetBuild) {
  const { css, rendered, worn } = await warm(join(build.serverDir, build.entry), {
    entries: build.entries ?? ['/'],
    limit: build.limit ?? 60,
    env: build.env ?? {},
  });
  if (css === '') throw new Error('kit sheet: rendering the site compiled no stylesheet');

  const rules = wornRules(css, worn);
  const held = rules.join('\n');
  const file = squeeze(held);
  const digest = createHash('sha256').update(file).digest('hex').slice(0, 8);
  const name = `assets/kit-${digest}.css`;
  await mkdir(join(build.clientDir, 'assets'), { recursive: true });
  await writeFile(join(build.clientDir, name), file);

  const hits = await fill(build.serverDir, {
    [HREF_SLOT]: (build.base ?? '/') + name,
    [CSS_SLOT]: held,
  });
  for (const [slot, count] of Object.entries(hits)) {
    if (count === 0) throw new Error(`kit sheet: ${slot} is missing from the server bundle`);
  }
  return { name, css, held, file, rendered };
}

/**
 * Ships the kit's compiled stylesheet as a hashed file instead of a block of
 * `<style>` on every response.
 *
 * react-native-web mints its atomic CSS while it renders, and a recipe compiles
 * on the first render of each variant, so no import of the module graph can
 * collect the sheet: the build has to render the site. This renders the server
 * bundle once it is written, crawling from `entries` the way the prerenderer
 * crawls links, and keeps the rules those renders wore. What a page wears and
 * the file does not hold is still inlined per response, so a variant no page
 * rendered here paints anyway.
 */
export function kitSheet(options: KitSheetOptions = {}): Plugin {
  let base = '/';
  let clientDir = '';

  return {
    name: 'kroma:kit-sheet',
    apply: 'build',
    configResolved(config) {
      base = config.base;
      const client = config.environments.client?.build;
      clientDir = client ? resolve(config.root, client.outDir) : '';
    },
    async writeBundle(_options, bundle) {
      if (this.environment.name !== 'ssr') return;
      const serverDir = resolve(this.environment.config.root, this.environment.config.build.outDir);
      const entry = Object.values(bundle).find(
        (chunk) => chunk.type === 'chunk' && chunk.isEntry,
      )?.fileName;
      if (entry === undefined) throw new Error('kit sheet: the server build has no entry');

      const { name, css, held, file, rendered } = await writeKitSheet({
        ...options,
        serverDir,
        entry,
        clientDir: clientDir === '' ? join(dirname(serverDir), 'client') : clientDir,
        base,
      });
      const all = css.split('\n').length;
      const kept = held.split('\n').length;
      this.info(
        `${name}: ${rendered.length} pages compiled ${all} rules, ${kept} of them worn, ${css.length} B down to ${file.length} B`,
      );
    },
  };
}
