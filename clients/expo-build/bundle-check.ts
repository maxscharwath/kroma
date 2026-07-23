#!/usr/bin/env bun
// Bundle an Expo client for both native platforms and fail if either breaks.
//
// Shared by the native TV app and the mobile app, because they need the same
// gate for the same reason: both render the shared @kroma/ui design system,
// both are EDITED almost entirely while looking at a browser shell, and nothing
// else in the pipeline would notice a DOM element or a browser-only API sneaking
// back in. Metro would, at the worst possible moment.
//
// It bundles, it does not build an app: no Xcode, no Gradle, no signing. That
// keeps it fast enough to run on every push while still proving the one thing
// that actually regresses.
//
//   bun clients/expo-build/bundle-check.ts <project-dir> [ENV_KEY=value ...]

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const [dir, ...envArgs] = process.argv.slice(2);
if (!dir) {
  console.error('usage: bundle-check.ts <project-dir> [KEY=value ...]');
  process.exit(2);
}
const root = resolve(process.cwd(), dir);
const extraEnv = Object.fromEntries(
  envArgs.map((pair) => {
    const at = pair.indexOf('=');
    return [pair.slice(0, at), pair.slice(at + 1)];
  }),
);

const platforms = ['ios', 'android'] as const;

/** Bundle one platform. Neither depends on the other's result, so the two runs
 * are started together: a Metro export of this workspace is minutes, and this
 * gate runs for two clients on every push. */
async function bundle(platform: (typeof platforms)[number]): Promise<string | null> {
  const out = mkdtempSync(join(tmpdir(), `kroma-bundle-${platform}-`));
  try {
    // `node`, not bun: the Expo CLI shells out to Metro, which expects Node.
    const { stdout, stderr } = await run(
      'node',
      ['node_modules/.bin/expo', 'export', '--platform', platform, '--output-dir', out],
      { cwd: root, env: { ...process.env, ...extraEnv }, maxBuffer: 64 * 1024 * 1024 },
    );
    const size =
      /[a-z]+-[a-f0-9]+\.hbc \(([^)]+)\)/.exec(`${stdout}${stderr}`)?.[1] ?? 'unknown size';
    console.log(`bundling ${platform}... ok (${size})`);
    return null;
  } catch (err) {
    const { stdout = '', stderr = '' } = err as { stdout?: string; stderr?: string };
    console.log(`bundling ${platform}... FAILED`);
    return `${stdout}${stderr}`.split('\n').slice(-25).join('\n');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const failures = (await Promise.all(platforms.map(bundle))).filter((f) => f !== null);
if (failures.length > 0) {
  for (const output of failures) console.error(output);
  process.exit(1);
}
console.log('\nBoth native bundles build from the shared source.');
