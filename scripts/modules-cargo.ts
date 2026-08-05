#!/usr/bin/env bun

// Run one cargo subcommand across every module workspace.
//
// Modules are not members of the server workspace (each is its own, at
// modules/<id>/server), so `cargo test --workspace` from server/ does not reach
// them. This is what keeps them covered.
//
//   bun run scripts/modules-cargo.ts test
//   bun run scripts/modules-cargo.ts clippy --all-targets
//
// Every module builds into the SHARED target dir, so the dependency graph they
// have in common is compiled once rather than once per module.

import { existsSync } from 'node:fs';
import { $ } from 'bun';
import { KMOD_TARGET_DIR, packableModules } from './pack-module';

const args = process.argv.slice(2);
if (args.length === 0) throw new Error('usage: modules-cargo.ts <cargo-subcommand> [args...]');

// Default features, NOT the `[package.metadata.kmod]` ones: those pull the heavy
// optional backends (candle for whisper/vector, librqbit for torrents), and
// compiling them here would roughly double this job for the five tests that sit
// behind them (whisper 1, torrents 2, vector 2). Everything else runs. The
// shipped feature set is still compiled by modules:pack in the release job.
// Pass features explicitly to cover those five: `modules-cargo.ts test --features local`.
const failed: string[] = [];
for (const dir of packableModules()) {
  const id = dir.split('/').pop() ?? dir;
  // A module may ship a frontend and no backend at all; there is nothing to run.
  if (!existsSync(`${dir}/server/Cargo.toml`)) continue;
  console.log(`\n=== ${id}: cargo ${args.join(' ')}`);
  const result = await $`cargo ${args}`
    .cwd(`${dir}/server`)
    .env({ ...process.env, CARGO_TARGET_DIR: KMOD_TARGET_DIR })
    .nothrow();
  if (result.exitCode !== 0) failed.push(id);
}

if (failed.length > 0) {
  console.error(`\ncargo ${args[0]} failed in ${failed.length} module(s): ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\ncargo ${args[0]}: every module passed`);
