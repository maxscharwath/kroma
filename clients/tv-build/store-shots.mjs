// Captures the 1920x1080 store screenshots both TV stores ask for, by driving a
// BUILT TV shell with a remote (arrow keys + Enter) in headless Chromium.
//
// Samsung wants exactly 4 at 1920x1080 (JPG, <=500kB); LG takes up to 6 at
// 1920x1080 or 1280x720. Shooting the real build rather than mocking a page
// means the store art IS the app - same fonts, same focus ring, same catalogue.
//
//   VITE_KROMA_SERVER=http://your-server:4040 bun run build:webos
//   (cd clients/webos && bunx vite preview --port 4173 --strictPort) &
//   bun clients/tv-build/store-shots.mjs 4173 clients/webos/store/shots
//
// The TV router is a MEMORY history ("a TV has no address bar" - see
// packages/tv/src/app/router.tsx), so a screen is reached by pressing the keys a
// viewer would press, not by navigating to a URL. That makes the sequence below
// depend on the catalogue: how many rails home has, how many tiles precede the
// one worth photographing. Tune SCREENS against your own server, using the
// on-screen text this prints after every step to see where focus actually is.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const port = process.argv[2];
const out = process.argv[3];
if (!port || !out) throw new Error('usage: store-shots.mjs <preview-port> <out-dir>');
mkdirSync(out, { recursive: true });

/** The brand intro plays on a cold launch and cannot be skipped from outside the
 * app, so the first capture waits it out. */
const INTRO_MS = 10_000;

/**
 * The story the listing tells, in order. `keys` are pressed BEFORE the capture,
 * starting from wherever the previous screen left focus.
 *
 * Only the signed-out screens are declared here, because they are the only ones
 * that are the same on every install. A server with a catalogue adds the screens
 * that actually sell the app - home, a detail page, the player - and their key
 * sequences are specific to that catalogue's shape; add them here once you point
 * this at a populated server.
 */
const SCREENS = [
  { name: '00-profiles', keys: [] },
  { name: '01-settings', keys: ['ArrowDown', 'Enter'] },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 200)));

/** Press a remote key, letting the focus animation settle afterwards. */
async function press(key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(340);
}

await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(INTRO_MS);

for (const { name, keys } of SCREENS) {
  for (const key of keys) await press(key);
  await page.waitForTimeout(400);
  writeFileSync(join(out, `${name}.png`), await page.screenshot({ type: 'png' }));
  const seen = (await page.locator('body').innerText()).replace(/\s*\n+\s*/g, ' · ').slice(0, 160);
  console.log(`${name}.png  ${seen}`);
}

await browser.close();
