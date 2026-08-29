import type { Page } from 'playwright';
import { type Reading, read } from './read';

const SETTLE_MS = 220;
const BAND_SETTLE_MS = 400;
const POLL_MS = 250;
const READY_MS = 45_000;
const BAND_PRESSES = 6;

// The grid's own shape of use: along a row, down into the next, back left. A
// television only ever moves one cell at a time, which is what makes a ring
// that fails to move show up as a second ring rather than as no ring at all.
const WALK = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];

async function press(page: Page, key: string, settleMs = SETTLE_MS): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(settleMs);
}

// A dev server compiles on demand, so how long a screen takes to arrive is a
// property of the machine and not of the app. Every wait here is a condition
// with a deadline rather than a duration, or a cold run measures a half-mounted
// tree and calls it a reading.
async function until(page: Page, ready: (seen: Reading) => boolean, what: string): Promise<void> {
  const deadline = Date.now() + READY_MS;
  while (Date.now() < deadline) {
    if (ready(await read(page))) return;
    await page.waitForTimeout(POLL_MS);
  }
  throw new Error(`${what} never happened within ${READY_MS}ms`);
}

function ringedTab(seen: Reading): string | null {
  const tab = seen.ringed.find((entry) => entry.startsWith('tab:'));
  return tab ? tab.slice('tab:'.length) : null;
}

async function focusedTab(page: Page): Promise<string | null> {
  return ringedTab(await read(page));
}

async function tabLabels(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"]')].map((el) => el.getAttribute('aria-label') ?? ''),
  );
}

export async function boot(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await until(page, (seen) => seen.rings > 0, 'the app never took focus');
}

/**
 * Drive the remote from wherever focus sits to the top-bar destination
 * `label` names, and open it. Pressed rather than clicked: a pointer click
 * navigates but leaves the destination with nothing focused, which is not a
 * state any viewer can reach.
 */
export async function openDestination(page: Page, label: string): Promise<void> {
  for (let up = 0; up < BAND_PRESSES && !(await focusedTab(page)); up += 1) {
    await press(page, 'ArrowUp', BAND_SETTLE_MS);
  }
  const from = await focusedTab(page);
  if (!from) throw new Error('the top bar never took focus; no tab is wearing the ring');

  const labels = await tabLabels(page);
  const to = labels.indexOf(label);
  if (to === -1) {
    throw new Error(`no top-bar destination "${label}"; the bar reads ${labels.join(', ')}`);
  }
  const step = to - labels.indexOf(from);
  for (let at = 0; at < Math.abs(step); at += 1) {
    await press(page, step > 0 ? 'ArrowRight' : 'ArrowLeft');
  }

  const landed = await focusedTab(page);
  if (landed !== label) throw new Error(`the ring stopped on "${landed}", not "${label}"`);
  await press(page, 'Enter');
  await until(page, (seen) => ringedTab(seen) === null, `"${label}" never took the focus`);
}

// More rings first, since a grid lighting every tile is the failure this walk
// exists for; a tie goes to the reading with more controls buried under others.
function worse(seen: Reading, worst: Reading | null): boolean {
  if (!worst) return true;
  if (seen.rings !== worst.rings) return seen.rings > worst.rings;
  return seen.overlaps > worst.overlaps;
}

/** The walk, sampled after EVERY press rather than only at its end. A row
 * entering the window lights up for the commit that mounts it and is clean
 * again by the time the walk stops, so a reading taken at rest and after the
 * walk sees nothing: that is how a grid ringing every tile of its incoming row
 * survived a green probe. `worst` is the reading to judge, not the last one. */
export async function walk(
  page: Page,
  presses: number,
  sample: (page: Page) => Promise<Reading>,
): Promise<Reading> {
  let worst: Reading | null = null;
  let pressed = 0;
  while (pressed < presses) {
    for (const key of WALK) {
      if (pressed >= presses) return worst ?? (await sample(page));
      await press(page, key);
      pressed += 1;
      const seen = await sample(page);
      if (worse(seen, worst)) worst = seen;
    }
  }
  return worst ?? (await sample(page));
}
