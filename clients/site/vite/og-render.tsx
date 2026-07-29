/**
 * Renders every Open Graph card to PNG and writes them to stdout as base64, keyed by
 * filename. Run by vite/og.ts during the build and on the first dev request, never by
 * hand.
 *
 * A separate entry point run by BUN, rather than code the plugin calls directly, for
 * one reason: the card reads `@kroma/ui`'s design tokens through the package's public
 * entry, and that entry is workspace TypeScript whose barrel re-exports are
 * extensionless. Vite's config loader externalizes bare imports and leaves them to
 * Node, which cannot resolve `./colors` without an extension - so a plugin that
 * imported the card would break the whole config. Bun resolves that graph the same
 * way the app's own build does, which keeps the card importing the real tokens
 * instead of a copy that can drift.
 *
 * JSX -> PNG with Takumi (a Rust renderer): no headless browser, no network. Takumi
 * reads a VARIABLE font's `fvar` table, so both faces come straight out of the kit -
 * the previous renderer could not, and needed static 400/600 instances of the kit's
 * variable Hanken committed beside it and regenerated with fontTools by hand.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from 'takumi-js';
import { Renderer } from 'takumi-js/node';
import { OgCard } from './og-card';
import { OG_CARDS } from './og-cards';

const here = dirname(fileURLToPath(import.meta.url));
/** The kit's own font files, the same two faces the pages load. */
const kitFonts = join(here, '..', '..', '..', 'packages', 'ui', 'src', 'assets', 'fonts');

const renderer = new Renderer();
const [display, ui] = await Promise.all([
  readFile(join(kitFonts, 'BricolageGrotesque-ExtraBold.ttf')),
  readFile(join(kitFonts, 'HankenGrotesk.ttf')),
]);
await renderer.registerFont({ name: 'Bricolage Grotesque', data: display, weight: 800 });
// No `weight` on the variable file: pinning one collapses its axes, and the card's
// 400 and 600 runs would then both render at that single weight.
await renderer.registerFont({ name: 'Hanken Grotesk', data: ui });

// The cards go back over STDOUT, keyed by filename, and this script touches no path but
// the two fonts it reads. It used to take an output directory as an argument and write
// through it - which meant a filesystem path built from argv, and the plugin cleaning up a
// temp directory afterwards. The caller already holds the bytes in memory to emit them as
// build assets, so the file on disk in between was never needed.
const cards: Record<string, string> = {};

for (const card of Object.values(OG_CARDS)) {
  const png = await render(<OgCard title={card.title} sub={card.sub} />, {
    renderer,
    // `width`/`height` are the OUTPUT pixels and `devicePixelRatio` scales the
    // layout into them, so this is the card's 1200x630 design laid out once and
    // rasterized @2x - sharp where a platform renders it large. Passing 1200x630
    // with a ratio of 2 would instead draw the layout twice its size and crop it.
    width: 2400,
    height: 1260,
    devicePixelRatio: 2,
    // PNG rather than the smaller WebP: the only consumers are social scrapers and
    // not all of them decode WebP.
    format: 'png',
  });
  cards[card.file] = Buffer.from(png).toString('base64');
}

process.stdout.write(JSON.stringify(cards));
