// The dev server's stylesheet: a build writes every compiled rule into the
// static sheet, a dev server has no such sheet and each module injects its own
// rules as it loads. One <style> per priority group, in group order, so a
// longhand's class outranks a shorthand's whatever order the modules arrived.

import { webDocument } from '#ui/lib/dom';

/** A rule and the priority group it belongs to; lower groups paint first. */
export type RuleEntry = readonly [group: number, css: string];

const ATTR = 'data-kroma-atomic';

const inserted = new Set<string>();

const sheets: { group: number; sheet: CSSStyleSheet }[] = [];

function sheetFor(doc: Document, group: number): CSSStyleSheet | null {
  const found = sheets.find((entry) => entry.group === group);
  if (found) return found.sheet;
  const element = doc.createElement('style');
  element.setAttribute(ATTR, String(group));
  const after = sheets.findIndex((entry) => entry.group > group);
  const before =
    after === -1 ? null : doc.querySelector(`style[${ATTR}="${sheets[after]?.group}"]`);
  doc.head.insertBefore(element, before);
  const sheet = element.sheet;
  if (!sheet) return null;
  sheets.splice(after === -1 ? sheets.length : after, 0, { group, sheet });
  return sheet;
}

/** Inserts the rules once each; a rule an engine cannot parse is skipped. */
export function injectRules(entries: readonly RuleEntry[]): void {
  const doc = webDocument();
  if (!doc) return;
  for (const [group, css] of entries) {
    if (inserted.has(css)) continue;
    inserted.add(css);
    const sheet = sheetFor(doc, group);
    if (!sheet) continue;
    try {
      sheet.insertRule(css, sheet.cssRules.length);
    } catch {
      /* the engine cannot parse this rule and paints without it */
    }
  }
}
