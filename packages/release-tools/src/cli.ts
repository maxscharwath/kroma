#!/usr/bin/env bun
// The reference consumer: wires git + files + the default config into the
// library. All release logic lives in the tested core/manifests/io modules; this
// file only parses argv, reads/writes files, and prints (or drives the TUI).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { prepend, renderEntry } from './core/changelog';
import { parseCommits } from './core/commits';
import { applyBump, nextVersion, parseLevel } from './core/semver';
import type { ParsedCommit } from './core/types';
import { commitsSince } from './io/git';
import { cliSummariser, commitContext } from './io/summarize';
import { interactiveRelease } from './io/tui';
import { type ManifestUpdater, updaterFor } from './manifests';

const USAGE =
  'usage: release-tools --manifest <path> [--since <ref>] [--paths a,b] ' +
  '[--bump patch|minor|major] [--changelog CHANGELOG.md] [--summarize] [--interactive] [--write]';

const FLAGS = ['write', 'summarize', 'interactive'] as const;
const OPTIONS = ['manifest', 'changelog', 'since', 'paths', 'bump'] as const;
const ALIASES: Record<string, string> = { '-i': '--interactive' };

type Args = Partial<Record<(typeof FLAGS)[number], boolean>> &
  Partial<Record<(typeof OPTIONS)[number], string>>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = ALIASES[argv[i] ?? ''] ?? argv[i] ?? '';
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if ((FLAGS as readonly string[]).includes(key)) args[key as (typeof FLAGS)[number]] = true;
    else if ((OPTIONS as readonly string[]).includes(key)) {
      args[key as (typeof OPTIONS)[number]] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function fail(message: string, code: number): never {
  console.error(message);
  process.exit(code);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// DX: default the range start to the newest `vX.Y.Z` tag, so `--since` is
// optional in the common case.
function latestVersionTag(): string | null {
  try {
    const out = execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], {
      encoding: 'utf8',
    });
    return out.split('\n')[0]?.trim() || null;
  } catch {
    return null;
  }
}

function summarise(commits: ParsedCommit[]): string | undefined {
  return cliSummariser()(commitContext(commits)) ?? undefined;
}

// The one place that touches disk on a successful release.
function write(
  args: Args,
  updater: ManifestUpdater,
  manifestText: string,
  version: string,
  entry: string,
): void {
  if (!args.manifest) return;
  writeFileSync(args.manifest, updater.write(manifestText, version));
  if (args.changelog) {
    writeFileSync(args.changelog, prepend(readFileSync(args.changelog, 'utf8'), entry));
  }
}

// The bump to apply: a manual --bump overrides the commit-derived level.
function chooseVersion(args: Args, current: string, commits: ParsedCommit[]): string | null {
  if (!args.bump) return nextVersion(current, commits);
  const level = parseLevel(args.bump);
  if (!level) fail(`--bump must be one of patch, minor, major (got "${args.bump}")`, 2);
  return applyBump(current, level);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest) fail(USAGE, 2);

  const since = args.since ?? latestVersionTag();
  if (!since) fail('no --since given and no vX.Y.Z tag found to default to.', 1);

  const manifestText = readFileSync(args.manifest, 'utf8');
  const updater = updaterFor(args.manifest);
  const current = updater.read(manifestText);
  if (!current) fail(`no version field found in ${args.manifest}`, 1);

  const commits = parseCommits(commitsSince(since, args.paths ? args.paths.split(',') : []));

  if (args.interactive) {
    const result = await interactiveRelease({
      manifestPath: args.manifest,
      current,
      commits,
      today: today(),
      summarise: cliSummariser(),
    });
    if (result) write(args, updater, manifestText, result.version, result.entry);
    return;
  }

  const next = chooseVersion(args, current, commits);
  if (!next) {
    console.log(`No release-worthy commits for ${args.manifest} since ${since}.`);
    return;
  }

  const entry = renderEntry(next, today(), commits, {
    summary: args.summarize ? summarise(commits) : undefined,
  });

  if (!args.write) {
    console.log(`${current} -> ${next}\n\n${entry}`);
    return;
  }

  write(args, updater, manifestText, next, entry);
  console.log(
    `${args.manifest}: ${current} -> ${next}${args.changelog ? ` (+ ${args.changelog})` : ''}`,
  );
}

main();
