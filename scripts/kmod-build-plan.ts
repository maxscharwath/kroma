#!/usr/bin/env bun

// Emit the `cargo build` commands that produce every sidecar module's native
// binary, derived from each module's Cargo.toml. CI runs them inside the musl
// cross-toolchain image, then packs the results on the host.
//
//   KMOD_TARGET=x86_64-unknown-linux-musl bun run scripts/kmod-build-plan.ts
//
// Run the emitted script from the REPO ROOT (the manifest paths are relative
// to it), not from server/.

import { relative } from 'node:path';
import { crateAndBin, KMOD_TARGET_DIR, packableModules, root } from './pack-module';

const target = process.env.KMOD_TARGET?.trim();
const targetArg = target ? ` --target ${target}` : '';

// Each module is its own cargo workspace now, so there is no single invocation
// that can select them all. They share ONE target dir instead: the dep graph
// (axum, tokio, candle, librqbit...) is then compiled once and reused across
// modules, which is what the old single-invocation build really bought. Cargo
// takes an exclusive lock on that dir, so these must run in sequence — the
// residual cost versus one invocation is that the final links no longer overlap.
const lines = [`export CARGO_TARGET_DIR=${KMOD_TARGET_DIR}`];

for (const dir of packableModules()) {
  const { bin, features } = crateAndBin(dir);
  if (!bin) continue; // library module: nothing to compile
  // Bare feature names: inside its own single-package workspace, `pkg/feat`
  // would mean "feature `feat` of DEPENDENCY `pkg`" and fails to resolve.
  const feat = features.length ? ` --features ${features.join(',')}` : '';
  const manifest = relative(root, `${dir}/server/Cargo.toml`);
  lines.push(
    `cargo build --profile release-kmod --manifest-path ${manifest} --bin ${bin}${feat}${targetArg}`,
  );
}

process.stdout.write(`${lines.join('\n')}\n`);
