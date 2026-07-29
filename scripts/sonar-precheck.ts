// A fast, offline stand-in for the SonarCloud rules this repo keeps tripping.
//
// The real analysis runs in CI and takes ~10 minutes, which is far too slow to
// iterate against. Most of what it catches here is not deep dataflow - it is a
// handful of mechanical patterns that a grep can find in under a second. This
// covers those, so a Sonar regression is caught before the push rather than
// after it.
//
// It is NOT a replacement for the CI scan, and deliberately covers only rules it
// can decide from one line with no false positives. Cognitive complexity (S3776)
// and nested ternaries (S3358) are both left out: the first needs a real metric
// and the second reads identically to a ternary inside an object literal, so a
// regex version cried wolf on code Sonar accepts. Anything this misses, CI still
// gates. Run: `bun run sonar:precheck`.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';

interface Rule {
  /** The SonarCloud rule key, so a hit can be looked up. */
  id: string;
  what: string;
  /** Matched per line. */
  test: RegExp;
  /** Skip a line that legitimately matches (a comment explaining the rule). */
  unless?: RegExp;
}

const RULES: Rule[] = [
  {
    // Only a LITERAL pattern: `replace(/\+/g, '-')` is a `replaceAll('+', '-')`,
    // while `replace(/[^\x20-\x7E]/g, '')` has no string form and Sonar leaves
    // it alone. Calibrated against `packages/client/src/identity.ts`, which the
    // real analysis accepts.
    id: 'typescript:S7781',
    what: 'prefer String#replaceAll() over a global String#replace() with a literal pattern',
    test: /\.replace\(\/(?:[^\\/[\]().*+?{}|^$\n]|\\[^sSdDwWbBnrtu\n])+\/g\s*,/,
  },
  {
    id: 'typescript:S7758',
    what: 'prefer String#codePointAt() over String#charCodeAt()',
    test: /\.charCodeAt\(/,
  },
  {
    id: 'typescript:S7758',
    what: 'prefer String.fromCodePoint() over String.fromCharCode()',
    test: /String\.fromCharCode\(/,
  },
  {
    id: 'typescript:S8786',
    what: 'super-linear regex: an unanchored trailing-run strip backtracks at every position',
    test: /\/=\+\$\//,
  },
];

const EXTS = new Set(['.ts', '.tsx', '.mts', '.cts']);

/** Sonar analyses tests under a different profile and does not raise these rules
 * there - verified against `worker/grant.test.ts`, which trips two of them and
 * is reported clean. Matching that keeps this tool worth listening to. */
const IS_TEST = /\.(test|spec)\.[cm]?tsx?$/;

/** The files this branch touches.
 *
 * Sonar gates a PR on its NEW CODE, so scanning the whole tree reports things
 * the analysis deliberately ignores - the repo is at zero issues on `main`, and
 * every pattern still standing there is one Sonar has already accepted. */
function changedFiles(): string[] {
  const base = process.argv[2] ?? 'origin/main';
  const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`], {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter(
      (f) =>
        f && EXTS.has(extname(f)) && !f.endsWith('.gen.ts') && !IS_TEST.test(f) && existsSync(f),
    );
}

let hits = 0;
const files = changedFiles();
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // A line that is only a comment is describing the rule, not breaking it.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const rule of RULES) {
      if (rule.test.test(line) && !rule.unless?.test(line)) {
        console.log(`${file}:${i + 1}  ${rule.id}  ${rule.what}`);
        hits++;
      }
    }
  });
}

console.log(
  hits
    ? `\n${hits} likely Sonar issue(s) in ${files.length} changed file(s).`
    : `No known Sonar patterns in ${files.length} changed file(s).`,
);
process.exit(hits ? 1 : 0);
