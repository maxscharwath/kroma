#!/usr/bin/env bun

// Build a runtime-installable module bundle: compile the WASM backend, build the
// Module Federation frontend, and assemble a `.tar` you install from Admin -> Modules.
//
//   bun run modules:wasm [wasm-modules/<dir>]   (default: wasm-modules/dev.luma.hellowasm)
//
// Output: dist/wasm-modules/<id>.tar  (module.json + module.wasm + icon.svg + fe/)

import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';

const root = join(import.meta.dir, '..');
const moduleDir = join(root, process.argv[2] ?? 'wasm-modules/dev.luma.hellowasm');
const manifest = JSON.parse(readFileSync(join(moduleDir, 'module.json'), 'utf8')) as { id: string };
const { id } = manifest;
console.log(`building module bundle: ${id}`);

// 1) Compile the WASM backend guest.
const beDir = join(moduleDir, 'server');
if (existsSync(beDir)) {
  console.log('  - cargo build --target wasm32-unknown-unknown');
  await $`cargo build --release --target wasm32-unknown-unknown`.cwd(beDir);
}
const wasmOutDir = join(beDir, 'target/wasm32-unknown-unknown/release');
const wasmCandidates = existsSync(wasmOutDir)
  ? readdirSync(wasmOutDir)
      .filter((f) => f.endsWith('.wasm'))
      .sort()
  : [];
// A module that ships a backend but produced no .wasm did not actually build
// (e.g. the guest crate is not `crate-type = ["cdylib"]`). Fail loudly rather
// than shipping a backend-less bundle that 404s on every /api/plugin call.
if (existsSync(beDir) && wasmCandidates.length === 0) {
  throw new Error(
    `no .wasm produced in ${wasmOutDir}; is the guest crate crate-type = ["cdylib"]?`,
  );
}
if (wasmCandidates.length > 1) {
  console.warn(
    `  ! multiple .wasm found, using ${wasmCandidates[0]}: ${wasmCandidates.join(', ')}`,
  );
}
const wasmFile = wasmCandidates[0];

// 2) Build the Module Federation frontend remote.
const feDir = join(moduleDir, 'ui');
const feDist = join(feDir, 'dist');
if (existsSync(feDir)) {
  console.log('  - vite build (frontend remote)');
  await $`bun run build`.cwd(feDir);
  if (!existsSync(feDist)) {
    throw new Error(
      `ui/ built but produced no dist/ at ${feDist}; the module page would be missing`,
    );
  }
}

// 3) Stage the bundle contents.
const staging = join(moduleDir, '.bundle');
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
const entries: string[] = [];
copyFileSync(join(moduleDir, 'module.json'), join(staging, 'module.json'));
entries.push('module.json');
if (wasmFile) {
  copyFileSync(join(wasmOutDir, wasmFile), join(staging, 'module.wasm'));
  entries.push('module.wasm');
}
for (const icon of ['icon.svg', 'icon.png']) {
  if (existsSync(join(moduleDir, icon))) {
    copyFileSync(join(moduleDir, icon), join(staging, icon));
    entries.push(icon);
  }
}
if (existsSync(feDist)) {
  cpSync(feDist, join(staging, 'fe'), { recursive: true });
  entries.push('fe');
}

// 4) Assemble the tar (explicit entries -> no `./` prefix the unpacker skips).
const outDir = join(root, 'dist/wasm-modules');
mkdirSync(outDir, { recursive: true });
const tarPath = join(outDir, `${id}.tar`);
await $`tar -cf ${tarPath} -C ${staging} ${entries}`;
rmSync(staging, { recursive: true, force: true });

console.log(`\nbundle ready: ${tarPath}`);
console.log('install it from Admin -> Modules (Install a module), or via:');
console.log(
  `  curl -H "Authorization: Bearer <token>" --data-binary @${tarPath} <server>/api/admin/store/install`,
);
