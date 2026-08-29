#!/usr/bin/env bun
// Drives the real TV shell in a real browser and asserts what jsdom cannot see:
// that exactly ONE control wears the focus ring, that nothing shouted on the
// console, that the mounted control count stays bounded, and that the app's own
// frame counter reports frames. Exits non-zero on a failure, so a PR can be
// gated on it.
//
//   bun run tv:probe                          serve the shell, run, report
//   bun run tv:probe --url http://…:5179      against a shell already serving
//   bun run tv:probe --keys 48 --locale fr    a longer walk, read in French
//   bun run tv:probe --throttle 1 --shot p.png  full speed, keep the last frame

import { chromium } from 'playwright';
import { checks } from './check';
import { boot, openDestination, walk } from './drive';
import { locales, message } from './locale';
import { frames, read, startFrames } from './read';
import { serveTvShell } from './serve';
import { deviceEntries, SESSION_ENTRIES, stubApi } from './stub';

const DESTINATION = 'nav.films';
const STAGE = { width: 1920, height: 1080 };
const TALL = { width: 2260, height: 1778 };
const COMPLAINTS_SHOWN = 8;
const COMPLAINT_CHARS = 150;

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : (args[at + 1] ?? fallback);
};

const url = flag('url', '');
const locale = flag('locale', 'en');
const presses = Number(flag('keys', '24'));
const items = Number(flag('items', '120'));
const growth = Number(flag('growth', '3'));
const minFps = Number(flag('min-fps', '20'));
const shot = flag('shot', '');
// A viewport that leaves a row half in view: the overscan row a grid mounts
// below the fold is where a ring on every tile shows up.
const tall = args.includes('--tall');
// A television's browser is roughly six times slower than a developer laptop,
// and a race the remote can win on a laptop is a race it loses on the set.
const throttle = Number(flag('throttle', '6'));

// Five copies of one React warning are one bug, so a run prints the distinct
// complaints and how often each fired.
function tally(complaints: readonly string[]): Array<[string, number]> {
  const seen = new Map<string, number>();
  for (const complaint of complaints) {
    const line = complaint.replace(/\s+/g, ' ').slice(0, COMPLAINT_CHARS);
    seen.set(line, (seen.get(line) ?? 0) + 1);
  }
  return [...seen].slice(0, COMPLAINTS_SHOWN);
}

if (!locales().includes(locale)) {
  throw new Error(`unknown locale "${locale}"; the app speaks ${locales().join(', ')}`);
}
const destination = message(locale, DESTINATION);

const serving = url ? null : await serveTvShell();
const origin = serving ? serving.url : url;
const browser = await chromium.launch();
const complaints: string[] = [];

try {
  const page = await browser.newPage({ viewport: tall ? TALL : STAGE, deviceScaleFactor: 1 });
  page.on('console', (entry) => {
    if (entry.type() === 'error') complaints.push(entry.text());
  });
  page.on('pageerror', (error) => complaints.push(`pageerror: ${error.message}`));

  if (throttle > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }

  await stubApi(page, items);
  await page.addInitScript(
    ([device, session]) => {
      for (const [key, value] of Object.entries(device)) localStorage.setItem(key, value);
      for (const [key, value] of Object.entries(session)) sessionStorage.setItem(key, value);
    },
    [deviceEntries(origin, locale), SESSION_ENTRIES] as const,
  );

  await boot(page, origin);
  await openDestination(page, destination);

  const atRest = await read(page);
  await startFrames(page);
  const walked = await walk(page, presses, read);
  const measured = await frames(page);
  if (shot) await page.screenshot({ path: shot });

  const verdicts = checks({
    atRest,
    walked,
    frames: measured,
    console: complaints,
    growth,
    minFps,
  });

  console.log(
    `\n  ${origin}   ${destination}   ${presses} presses   ${items} items   CPU /${throttle}\n`,
  );
  for (const { name, reads, ok } of verdicts) {
    console.log(`  ${ok ? ' ok ' : 'FAIL'}  ${name.padEnd(24)} ${reads}`);
  }
  for (const [complaint, count] of tally(complaints)) {
    console.log(`\n        ${count} x  ${complaint}`);
  }
  console.log('');

  if (verdicts.some(({ ok }) => !ok)) process.exitCode = 1;
} finally {
  await browser.close();
  serving?.stop();
}
