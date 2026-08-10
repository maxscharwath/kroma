import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOTS = ['packages', 'apps', 'clients'].map((r) =>
  resolve(fileURLToPath(new URL('../../../..', import.meta.url)), r),
);

const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.vite', '.tanstack']);

const SOURCE = /\.(ts|tsx)$/;

const RELATIVE_IMPORT = /from\s+['"](\.[^'"]*\.(?:ts|tsx))['"]/g;

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    let directory: boolean;
    try {
      directory = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (directory) walk(full, out);
    else if (SOURCE.test(name)) out.push(full);
  }
}

/**
 * A platform file is only consulted for an EXTENSIONLESS specifier: both Vite
 * and Metro read `resolve.extensions` only when the import has none, so
 * `./thing.ts` resolves straight past `./thing.web.ts`. That failure is silent -
 * the wrong module loads and the build succeeds - so it is caught here instead.
 */
describe('platform files', () => {
  it('are never reached through an explicit extension', () => {
    const files: string[] = [];
    for (const root of ROOTS) walk(root, files);

    const offenders: string[] = [];
    for (const file of files) {
      let source: string;
      try {
        source = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const [, specifier] of source.matchAll(RELATIVE_IMPORT)) {
        if (!specifier) continue;
        const target = resolve(dirname(file), specifier);
        const web = target.replace(/\.(ts|tsx)$/, (_, ext) => `.web.${ext}`);
        if (existsSync(web)) offenders.push(`${file} imports ${specifier} (shadowed by ${web})`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
