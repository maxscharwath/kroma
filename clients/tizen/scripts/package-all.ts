// Every installable package of one build, signed and named, into `out/`:
//
//   KROMA-tizen-<version>.wgt       every tier, the gate chooses (the Store package)
//   KROMA-tizen8-<version>.wgt      Tizen 8.0 and newer (2024+)
//   KROMA-tizen4to7-<version>.wgt   Tizen 4.0 to 7.0 (2018 to 2023)
//   KROMA-tizen3-<version>.wgt      Tizen 3.0 (2017)
//
//   bun scripts/package-all.ts --profile kroma-ci --version 0.1.39
//
// Needs `tizen` (Tizen Studio CLI) on the PATH and a signing profile; the
// release job creates a throwaway one, `make package` uses yours.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { TIER_NAMES, TIERS } from './tiers';

const SHELL = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(SHELL, 'out');

const { values } = parseArgs({
  options: {
    profile: { type: 'string' },
    version: { type: 'string' },
  },
});
if (!values.profile || !values.version) {
  console.error('usage: package-all.ts --profile <signing profile> --version <x.y.z>');
  process.exit(1);
}
const { profile, version } = values;

if (!existsSync(join(SHELL, 'dist/index.html'))) {
  console.error('[package] no build at dist/. Run `bun run build:tizen` first.');
  process.exit(1);
}

const run = (command: string, args: string[]) =>
  execFileSync(command, args, { cwd: SHELL, stdio: 'inherit' });

function pack(dir: string, name: string): void {
  run('tizen', ['package', '-t', 'wgt', '-s', profile, '--', dir]);
  const wgt = readdirSync(dir).find((f) => f.endsWith('.wgt'));
  if (!wgt) throw new Error(`tizen package left no .wgt in ${dir}`);
  renameSync(join(dir, wgt), join(OUT, name));
  console.log(`[package] ${name}`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

pack(join(SHELL, 'dist'), `KROMA-tizen-${version}.wgt`);
for (const tier of TIER_NAMES) {
  run('bun', ['scripts/slice.ts', tier]);
  pack(join(SHELL, `dist-${tier}`), `KROMA-${TIERS[tier].name}-${version}.wgt`);
}
