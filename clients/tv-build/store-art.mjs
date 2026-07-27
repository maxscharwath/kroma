// Rasterises the KROMA brand lockup for the TV store packages.
//
// The lockup only exists as SVG (.github/assets), and neither store takes one:
// LG wants a PNG splash inside the .ipk, Samsung a transparent PNG logo plus a
// separate background it composites itself. Chromium is already a build
// dependency here (playwright drives the on-device checks), so it is what
// rasterises - no ImageMagick/librsvg to install, and the letterforms come out
// of the same engine that renders them in the app.
//
// Writes raw lockup PNGs to a work directory; store-art.py composes the actual
// deliverables from them. Run via `bun run store:art` at the repo root.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const REPO = new URL('../..', import.meta.url).pathname;
const OUT = process.argv[2];
if (!OUT) throw new Error('usage: store-art.mjs <out-dir>');
mkdirSync(OUT, { recursive: true });

/** Render an SVG file at an exact pixel size, on a transparent canvas. The SVG
 * is inlined into a bare page sized to match, so the screenshot is the artwork
 * and nothing else (no scrollbars, no default margin). */
async function raster(page, svgPath, width, height, out) {
  const svg = readFileSync(join(REPO, svgPath), 'utf8')
    .replace(/\swidth="[^"]*"/, ` width="${width}"`)
    .replace(/\sheight="[^"]*"/, ` height="${height}"`);
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;padding:0;background:transparent}
     svg{display:block}</style>${svg}`,
    { waitUntil: 'load' },
  );
  const shot = await page.screenshot({ omitBackground: true, type: 'png' });
  writeFileSync(join(OUT, out), shot);
  console.log(`${out}  ${width}x${height}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

// The bare wordmark + wheel, ivory on transparent. 458x100 source, rendered at
// 4x so it stays crisp when composed down onto a 1920x1080 canvas.
await raster(page, '.github/assets/kroma-lockup-ivory.svg', 1832, 400, 'lockup-ivory.png');

await browser.close();
