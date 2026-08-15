#!/usr/bin/env bun
// The kit's DOM audit, driven from one command. Renders every story view through
// react-native-web, counts what it costs, and prints the worklist worst first.
//
//   bun run kit:dom                  the whole kit, report to packages/ui/.dom
//   bun run kit:dom ListRow Field    those components, with their annotated trees
//   bun run kit:dom --write          move the ratchet in budget.json
//
// A wrapper rather than a plain script because the rendering has to happen under
// the repo's own vitest config: it is the only place that knows `#ui/*`, the
// react-native -> react-native-web alias and the story plugins.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../../', import.meta.url).pathname;
const TEST = 'packages/ui/audit/dom-budget.test.tsx';

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const only = args.filter((arg) => !arg.startsWith('--'));
const writing = flags.has('--write');
const tree = flags.has('--tree') || (only.length > 0 && !writing);

// A story that prints a time must print the same one on every machine, or the
// paint snapshot records the developer's timezone.
const env = {
  ...process.env,
  TZ: 'UTC',
  LANG: 'en_US.UTF-8',
  KROMA_DOM: writing ? 'write' : 'report',
  KROMA_DOM_ONLY: only.join(','),
  ...(tree ? { KROMA_DOM_TREE: '1' } : {}),
};

// The runner by path, not by name: a bare command is looked up through PATH,
// which is one writable directory away from running something else entirely.
const VITEST = join(ROOT, 'node_modules', '.bin', 'vitest');

const run = spawnSync(VITEST, ['run', '--project', 'web', TEST, '--reporter=dot'], {
  cwd: ROOT,
  env,
  stdio: ['inherit', 'pipe', 'inherit'],
  encoding: 'utf8',
});

const OUT = `${ROOT}packages/ui/.dom/`;

function show(name: string): void {
  const file = `${OUT}${name}`;
  if (existsSync(file)) console.log(readFileSync(file, 'utf8'));
}

if (writing) {
  console.log('budget.json rewritten. Commit it with the reduction it records.');
} else {
  if (tree) show('tree.txt');
  show('digest.txt');
  console.log('\nfull report: packages/ui/.dom/report.md');
}

// The runner's own output is the failure message: which view moved, and how.
if (run.status !== 0) console.error(`\n${run.stdout ?? ''}`);

process.exit(run.status ?? 1);
