// Exercises a built package in Samsung's TV simulator: every tier the engine
// gate can choose, then the remote. Not part of `bun run test`, which has to run
// on a machine without Tizen Studio; run it by hand after `bun run build:tizen`,
// or with `--tier deep` to look at one.
//
// It answers what a static check cannot: that the gate resolves the way it was
// meant to, that the package paints in the Tizen webapis environment, and that
// the D-pad still walks the rails. It cannot answer the engine floor, because
// the simulator is modern Chromium whatever version it is told to be.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type RemoteKey, Simulator, type Tier } from './simulator.ts';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const INDEX = join(DIST, 'index.html');
const SHOTS = process.env.KROMA_SIM_SHOTS;

const EXPECTED: Record<Tier, string> = {
  modern: './assets/',
  legacy: './legacy/index.js',
  deep: './deep/index.js',
};

const WALK: RemoteKey[] = ['down', 'right', 'right', 'left', 'up'];

const failures: string[] = [];
const check = (tier: string, ok: boolean, label: string, detail = ''): void => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures.push(`${tier}: ${label}${detail ? ` (${detail})` : ''}`);
};

const asString = (value: unknown): string => (typeof value === 'string' ? value : String(value));

async function exercise(sim: Simulator, tier: Tier): Promise<void> {
  console.log(`\n${tier} tier`);
  await sim.load(INDEX, tier);
  const seen = await sim.inspect();
  const scripts = Array.isArray(seen.scripts) ? seen.scripts.map(asString) : [];

  check(
    tier,
    scripts.some((s) => s.startsWith(EXPECTED[tier])),
    'gate chose this tier',
    scripts.join(' '),
  );
  check(tier, Number(seen.rootChars) > 0, 'app rendered', `${seen.rootChars} chars`);
  check(tier, seen.tizen === 'object' && seen.webapis === 'object', 'tizen webapis present');
  check(
    tier,
    seen.bodyBackground === 'rgb(10, 10, 12)',
    'ground is the dark token',
    asString(seen.bodyBackground),
  );
  check(tier, seen.webfontApplied === true, 'webfont applied, not the default serif');
  check(tier, sim.errors().length === 0, 'no uncaught exceptions', sim.errors().join(' | '));

  if (tier === 'deep') {
    check(tier, seen.cascadeLayers === 'undefined', 'engine reports no cascade layers');
    check(tier, seen.customProperties === false, 'engine reports no custom properties');
  }
  if (SHOTS) await sim.screenshot(join(SHOTS, `sim-${tier}.png`));
}

async function exerciseRemote(sim: Simulator, tier: Tier): Promise<void> {
  console.log(`\n${tier} tier, remote`);
  const start = await sim.focusRing();
  console.log(`  start        ${start}`);

  const path: string[] = [];
  for (const key of WALK) {
    await sim.press(key);
    const at = await sim.focusRing();
    console.log(`  ${key.padEnd(12)} ${at}`);
    path.push(at);
  }
  check(tier, start !== 'nothing focused', 'something is focused at rest', start);
  check(
    tier,
    new Set(path).size > 1,
    'focus moves with the d-pad',
    `${new Set(path).size} distinct stops`,
  );
  check(
    tier,
    path.at(-1) === start,
    'the walk returns where it started',
    `${path.at(-1)} vs ${start}`,
  );
}

if (!existsSync(INDEX)) {
  console.error(`[simulator-check] no build at ${INDEX}. Run 'bun run build:tizen' first.`);
  process.exit(1);
}

const only = process.argv.includes('--tier')
  ? (process.argv[process.argv.indexOf('--tier') + 1] as Tier)
  : undefined;
const tiers: Tier[] = only ? [only] : ['modern', 'legacy', 'deep'];

const sim = await Simulator.launch({ tizenVersion: '3.0' });
try {
  for (const tier of tiers) await exercise(sim, tier);
  await exerciseRemote(sim, tiers.at(-1) ?? 'deep');
} finally {
  sim.close();
}

console.log(
  failures.length === 0
    ? `\n[simulator-check] ${tiers.join(', ')} OK in the Tizen simulator`
    : `\n[simulator-check] ${failures.length} failed:\n  ${failures.join('\n  ')}`,
);
process.exit(failures.length === 0 ? 0 : 1);
