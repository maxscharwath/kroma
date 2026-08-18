// A minimal SemVer range checker — the operators the manifests use (exact, ^, ~,
// >=, *) with correct pre-release semantics: a stable range never matches a
// pre-release (`^0.1.0` excludes `0.2.0-beta.1`); a pre-release only satisfies a
// range whose comparator is a pre-release of the same X.Y.Z. Pure, no deps.

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  // Dot-separated pre-release identifiers; [] means a stable release.
  prerelease: string[];
}

export function parse(version: string): SemVer | null {
  const match = version
    .trim()
    .replace(/^[v=]/, '')
    .match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

const isNumeric = (id: string) => /^\d+$/.test(id);

// SemVer pre-release precedence. A stable release (no identifiers) outranks any
// pre-release; between two pre-releases, compare identifier by identifier.
function comparePre(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    const x = a[i] ?? '';
    const y = b[i] ?? '';
    if (x === y) continue;
    if (isNumeric(x) && isNumeric(y)) return Number(x) < Number(y) ? -1 : 1;
    if (isNumeric(x) !== isNumeric(y)) return isNumeric(x) ? -1 : 1;
    return x < y ? -1 : 1;
  }
  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}

export function compare(a: SemVer, b: SemVer): number {
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    comparePre(a.prerelease, b.prerelease)
  );
}

const sameTuple = (a: SemVer, b: SemVer) =>
  a.major === b.major && a.minor === b.minor && a.patch === b.patch;

// Caret: compatible within the left-most non-zero segment (stable upper bound).
function caretUpper(base: SemVer): SemVer {
  const bump = (major: number, minor: number, patch: number): SemVer => ({
    major,
    minor,
    patch,
    prerelease: [],
  });
  if (base.major > 0) return bump(base.major + 1, 0, 0);
  if (base.minor > 0) return bump(0, base.minor + 1, 0);
  return bump(0, 0, base.patch + 1);
}

function tildeUpper(base: SemVer): SemVer {
  return { major: base.major, minor: base.minor + 1, patch: 0, prerelease: [] };
}

type Operator = '^' | '~' | '>=' | '=';

function operatorOf(range: string): Operator {
  if (range.startsWith('^')) return '^';
  if (range.startsWith('~')) return '~';
  if (range.startsWith('>=')) return '>=';
  return '=';
}

export function satisfies(version: string, range: string): boolean {
  const v = parse(version);
  if (!v) return false;
  const r = range.trim();
  // A wildcard matches any *stable* release (pre-releases stay opt-in).
  if (r === '' || r === '*' || r === 'latest') return v.prerelease.length === 0;

  const operator = operatorOf(r);
  const base = parse(operator === '=' ? r : r.slice(operator.length));
  if (!base) return false;

  // Pre-release gate: a pre-release version only satisfies a range whose own
  // comparator is a pre-release of the same X.Y.Z.
  if (v.prerelease.length > 0 && (base.prerelease.length === 0 || !sameTuple(v, base))) {
    return false;
  }

  if (operator === '=') return compare(v, base) === 0;
  if (operator === '>=') return compare(v, base) >= 0;
  const upper = operator === '^' ? caretUpper(base) : tildeUpper(base);
  return compare(v, base) >= 0 && compare(v, upper) < 0;
}
