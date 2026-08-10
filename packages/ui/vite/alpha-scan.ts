import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CANDIDATE = /['"]([a-zA-Z][a-zA-Z0-9]*)\/(\d+(?:\.\d+)?)['"]/g;

const SOURCE_EXT = /\.(ts|tsx)$/;

// `ios`, `android` and `src-tauri` hold no TypeScript, and `ios/Pods` alone is
// ~7,100 directories - most of the walk's cost (see ../bundler/index.ts, which
// skips the same trees for the same reason).
const SKIP = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.vite',
  '.tanstack',
  'ios',
  'android',
  'src-tauri',
]);

const isTest = (name: string) => name.includes('.test.') || name.includes('.stories.');

// One walk per root set per process: a stylesheet with two directives, and the
// second pass over the emitted assets, otherwise re-read the whole repo each
// time (see ../bundler/index.ts, which memoises its sibling scan the same way).
const CACHE = new Map<string, Set<string>>();

function walk(dir: string, out: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = entry.name;
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (entry.isDirectory()) walk(full, out);
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
  const key = `${roots.join('|')}::${[...known].sort().join(',')}`;
  const hit = CACHE.get(key);
  if (hit) return hit;

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
  CACHE.set(key, found);
  return found;
}
