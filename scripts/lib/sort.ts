// The one comparator the build scripts sort file names with.
//
// Every sort in these scripts feeds something that must be byte-identical on
// every machine: a generated roster, a catalog index, a validation report. A
// bare `.sort()` already orders by UTF-16 code unit, but it says so nowhere -
// and `localeCompare`, the usual answer, is the wrong fix here: it orders by
// whatever locale the build happens to run under, so the same module set would
// come out in one order on a laptop and another in CI. These are ASCII file
// names, not prose anyone reads.
//
// Stated once and shared, so the four call sites cannot drift apart.

/** Compares by UTF-16 code unit - the machine-independent ordering. */
export function byCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
