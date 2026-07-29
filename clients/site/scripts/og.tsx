/**
 * Renders the Open Graph social card, one PNG per locale, into `public/`.
 *
 *   bun run og
 *
 * JSX -> SVG with Satori, SVG -> PNG with resvg. No headless browser and no
 * network: the two brand faces are read straight out of `@kroma/ui`'s bundled
 * .ttf files, so the card renders identically on a laptop and in CI, and a
 * missing webfont can no longer silently swap the display face for a fallback.
 *
 * The card itself is a component - see ./og-card.tsx.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { OgCard } from './og-card';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
/** The kit's own font files. Bricolage ships static, so it is read from there
 *  directly; Hanken is a variable font, which Satori's parser cannot read - see
 *  ./fonts/README.md for the two static instances beside this script. */
const kitFonts = join(here, '..', '..', '..', 'packages', 'ui', 'src', 'assets', 'fonts');
const localFonts = join(here, 'fonts');

/**
 * The card's wording, per locale.
 *
 * Deliberately NOT read from the page's message catalogs: this copy is fitted to a
 * 1200x630 crop where the full page tagline would wrap to four lines, and the line
 * break is authored because Satori has no `text-wrap: balance`. `[…]` marks the
 * amber words, the same marker convention the site's messages use (lib/rich.ts).
 *
 * The base locale keeps the unsuffixed filename so a link shared before the site
 * was bilingual still resolves to a real image.
 */
const CARDS = {
  en: {
    file: 'og.png',
    title: 'Your media library, [at home].',
    sub: 'One self-hosted Rust binary. Direct-play HEVC on the web, on mobile and on every television.',
  },
  fr: {
    file: 'og.fr.png',
    title: 'Votre médiathèque, [chez vous].',
    sub: 'Un seul binaire Rust, auto-hébergé. Direct-play HEVC sur le web, le mobile et toutes les télévisions.',
  },
} as const;

const [display, ui400, ui600] = await Promise.all([
  readFile(join(kitFonts, 'BricolageGrotesque-ExtraBold.ttf')),
  readFile(join(localFonts, 'HankenGrotesk-400.ttf')),
  readFile(join(localFonts, 'HankenGrotesk-600.ttf')),
]);

const fonts = [
  { name: 'Bricolage Grotesque', data: display, weight: 800 as const, style: 'normal' as const },
  { name: 'Hanken Grotesk', data: ui400, weight: 400 as const, style: 'normal' as const },
  { name: 'Hanken Grotesk', data: ui600, weight: 600 as const, style: 'normal' as const },
];

for (const [locale, card] of Object.entries(CARDS)) {
  const svg = await satori(<OgCard title={card.title} sub={card.sub} />, {
    width: 1200,
    height: 630,
    fonts,
  });

  // @2x, so the card stays sharp where a platform renders it large.
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 2400 } }).render().asPng();
  await writeFile(join(publicDir, card.file), png);
  console.log(`wrote public/${card.file}  (${locale}, ${(png.length / 1024).toFixed(0)} KB)`);
}
