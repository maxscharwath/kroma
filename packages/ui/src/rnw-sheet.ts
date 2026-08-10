// The react-native-web stylesheet format, read from the outside.
//
// Two places decode it and they must agree exactly: the build plugin that
// writes the hashed file (@kroma/bundler/kit-sheet) and the runtime that
// subtracts that file from the live sheet (./ssr). A drift between them does
// not fail - it silently re-inlines every rule on every response, or drops
// rules a page needed - so the markers, the predicate and the slot names live
// here once rather than in both.
//
// Deliberately free of any react-native import: the build plugin runs in Node,
// where pulling in the kit's React face would not resolve.

/** The literals the build rewrites in the server bundle, once it has rendered
 *  the site and knows what the linked file holds. */
export const HREF_SLOT = '__KROMA_KIT_SHEET_HREF__';
export const CSS_SLOT = '__KROMA_KIT_SHEET_CSS__';

/** The group header react-native-web writes above each band of rules. It rebuilds
 *  its record by reading these back, so a rule that stays needs its marker. */
export const MARKER = '[stylesheet-group=';

const CLASS = /\.((?:css|r)-[\w-]+)/gi;
const ATTR = /class="([^"]*)"/g;

/** Every class name an HTML render is wearing. */
export function wornBy(html: string): Set<string> {
  const worn = new Set<string>();
  for (const match of html.matchAll(ATTR)) {
    for (const name of (match[1] ?? '').split(' ')) worn.add(name);
  }
  return worn;
}

/** The class names a chunk of CSS paints. */
export function classesIn(css: string): Set<string> {
  return new Set([...css.matchAll(CLASS)].map((match) => match[1] as string));
}

/**
 * Whether a rule earns its place.
 *
 * react-native-web compiles and inserts every rule of every style object it
 * touches, then picks the class names that win; the losers are in the sheet and
 * on no element. So a rule counts only if something is wearing one of its
 * classes. A rule that names none (the resets, the keyframes) always counts.
 */
export function isWorn(rule: string, worn: ReadonlySet<string>): boolean {
  let named = false;
  for (const match of rule.matchAll(CLASS)) {
    named = true;
    if (worn.has(match[1] as string)) return true;
  }
  return !named;
}
