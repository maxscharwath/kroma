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

// One invocation per module: each is its own workspace, so none can select them
// all. They share a target dir so the common dep graph compiles once; cargo
// locks that dir, so the builds run in sequence.
// Relative to the repo root, resolved by the shell that runs the plan: the
// cross legs execute it inside a container where the checkout is mounted at a
// different absolute path, so a host path would silently write to the
// container's own filesystem and vanish with it.
const lines = [`export CARGO_TARGET_DIR="$PWD/${relative(root, KMOD_TARGET_DIR)}"`];

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
