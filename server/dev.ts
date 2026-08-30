// Which loop `bun run server:watch` runs, and why there are two.
//
// With the Dioxus CLI on PATH the server runs under `dx serve --hot-patch`: an
// edit under server/src is compiled on its own and linked as a patch into the
// running process, so the binary is never relinked and the process never
// restarts. Everything under server/crates, and any change that moves a type, a
// signature or a dependency, still costs a full rebuild.
//
// Without it, or with KROMA_HOTPATCH=0, the loop is `cargo watch -x run`: a
// fresh clone runs `bun run dev` with no extra tooling.

const serverDir = new URL('.', import.meta.url).pathname;

// Deno ships a `dx` too, so finding the name on PATH proves nothing. Only a
// binary that answers `--version` with "dioxus" gets to drive the loop.
function dioxusCli(): string | null {
  const dx = Bun.which('dx');
  if (!dx) return null;
  const probe = Bun.spawnSync([dx, '--version']);
  const said = probe.stdout.toString() + probe.stderr.toString();
  return said.toLowerCase().includes('dioxus') ? dx : null;
}

const dx = process.env.KROMA_HOTPATCH === '0' ? null : dioxusCli();

if (dx) {
  console.log('[dev] hot patching: an edit under server/src reaches the running process, no restart.');
  console.log('[dev] `dx` keeps its own build cache, so the first run is a full build.');
} else if (process.env.KROMA_HOTPATCH !== '0') {
  console.log('[dev] no Dioxus CLI: full rebuild on every edit.');
  console.log('[dev] for hot patching: cargo install dioxus-cli@0.7.10 --locked');
}

const argv = dx
  ? [dx, 'serve', '--hot-patch', '--interactive=false', '--open=false', '--features', 'hotpatch', '--package', 'kroma-server']
  : ['cargo', 'watch', '-x', 'run'];

const child = Bun.spawn(argv, {
  cwd: serverDir,
  // `dx` runs the binary from inside a .app bundle, so the process CWD is not
  // server/ and the default `./data` would put the dev library somewhere else
  // on each loop. Both loops get the same absolute path instead.
  env: { ...process.env, KROMA_DATA_DIR: process.env.KROMA_DATA_DIR ?? `${serverDir}data` },
  stdio: ['inherit', 'inherit', 'inherit'],
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}

process.exit(await child.exited);
