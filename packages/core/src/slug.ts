// The combining-marks range, not `\p{M}`: this module ships to the legacy webOS
// tier, whose engine cannot parse unicode property escapes.

/** The URL segment a display name folds to: lowercased, accents dropped, every
 * run of anything else turned into one `-`, with no leading or trailing one.
 * Idempotent: a slug read back off a URL folds to itself. */
export function slugify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}
