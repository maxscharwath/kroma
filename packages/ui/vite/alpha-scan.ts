import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CANDIDATE = /['"]([a-zA-Z][a-zA-Z0-9]*)\/(\d+(?:\.\d+)?)['"]/g;

const SOURCE_EXT = /\.(ts|tsx)$/;

const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.vite', '.tanstack']);

const isTest = (name: string) => name.includes('.test.') || name.includes('.stories.');

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
    else if (SOURCE_EXT.test(name) && !isTest(name)) out.push(full);
  }
}

/**
 * Every `token/NN` written anywhere in the source, as `[token, alpha]` pairs.
 *
 * The alpha suffix is Tailwind's syntax and is always a literal in a recipe or a
 * prop, never computed, so the whole set is knowable without running anything —
 * the same reason Tailwind's own extractor can walk files and collect
 * candidates. That matters because a `var()` cannot be given an alpha without
 * `color-mix()`, which the legacy webOS tier cannot parse: each combination has
 * to exist as its own custom property instead.
 */
export function scanAlphas(roots: readonly string[], known: ReadonlySet<string>): Set<string> {
  const files: string[] = [];
  for (const root of roots) walk(root, files);

  const found = new Set<string>();
  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    CANDIDATE.lastIndex = 0;
    for (const [, token, alpha] of source.matchAll(CANDIDATE)) {
      if (token && alpha && known.has(token)) found.add(`${token}/${alpha}`);
    }
  }
  return found;
}
