// What a screen reader gets, written down so a DOM reduction cannot quietly take
// it away - and checked against the rules a control has to keep.
//
// The paint signature (paint.ts) proves the picture survived a refactor. This
// proves the OTHER half survived: the roles, the names, the states and the tab
// order. Removing a wrapper that carried an `aria-label` is invisible to a node
// count and to a pixel; it is one line missing here.

import { eachElement, tagOf } from './dom';
import { styleOf } from './style';

type A11yKind =
  | 'nameless-control'
  | 'hidden-focusable'
  | 'stateless-control'
  | 'unlabelled-input'
  | 'dangling-labelledby'
  | 'positive-tabindex'
  | 'imageless-alt'
  | 'unreachable-control';

interface A11yFinding {
  kind: A11yKind;
  at: string;
  note: string;
}

/** A rule broken, before the walk names where. */
type A11yIssue = Omit<A11yFinding, 'at'>;

// The roles whose whole job is to be operated, so one with no name is a control
// a screen reader announces as nothing at all.
const CONTROLS = new Set([
  'button',
  'link',
  'switch',
  'checkbox',
  'radio',
  'tab',
  'option',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'slider',
  'combobox',
  'textbox',
  'searchbox',
]);

// The roles that carry a state, and what ARIA calls it. A switch with no
// `aria-checked` announces as a button.
const STATE_OF: Record<string, string> = {
  switch: 'aria-checked',
  checkbox: 'aria-checked',
  radio: 'aria-checked',
  menuitemcheckbox: 'aria-checked',
  menuitemradio: 'aria-checked',
  tab: 'aria-selected',
  option: 'aria-selected',
  // A range announces where it sits or it announces nothing useful. This is the
  // half of a slider the DOM can prove, which is why it is checked here rather
  // than through the tab order (see UNPRESSED below).
  slider: 'aria-valuenow',
};

const ENTRIES = new Set(['input', 'textarea', 'select']);

// The roles no press operates: a range is dragged, and nudged by the key map of
// the surface that owns it (the player routes Left/Right and Up/Down on
// `window`, react-native-tvos on the remote). Neither the gesture nor the key
// map is in the DOM, so a missing tab stop here is not evidence of anything -
// where for a role whose whole operation is a press, it is.
const UNPRESSED = new Set(['slider']);

function roleOf(el: Element): string {
  const named = el.getAttribute('role');
  if (named) return named;
  const tag = tagOf(el);
  if (tag === 'button') return 'button';
  if (tag === 'a') return el.hasAttribute('href') ? 'link' : '';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (tag !== 'input') return '';
  const type = el.getAttribute('type') ?? 'text';
  if (type === 'checkbox' || type === 'radio') return type;
  return type === 'search' ? 'searchbox' : 'textbox';
}

/** The name a screen reader would read, by the parts of the accname algorithm a
 * kit component can actually reach: an explicit label, a referenced one, the
 * alternative text, the title, then the text inside - except for a text entry,
 * whose content is its VALUE and whose last-resort name is its placeholder
 * (HTML-AAM), which is what a browser announces for one. */
function nameOf(el: Element): string {
  const labelled = el.getAttribute('aria-labelledby');
  if (labelled) {
    const named = labelled
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (named) return named;
  }
  const label = el.getAttribute('aria-label')?.trim();
  if (label) return label;
  const alt = el.getAttribute('alt')?.trim();
  if (alt) return alt;
  const title = el.getAttribute('title')?.trim();
  if (title) return title;
  if (ENTRIES.has(tagOf(el))) {
    return el.getAttribute('placeholder')?.trim() ?? '';
  }
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function stateOf(el: Element): string {
  return [
    'aria-checked',
    'aria-selected',
    'aria-expanded',
    'aria-pressed',
    'aria-disabled',
    'aria-busy',
    'aria-current',
    'aria-valuenow',
    'aria-valuetext',
    'aria-hidden',
    'aria-live',
  ]
    .map((attr) => (el.hasAttribute(attr) ? `${attr.slice(5)}=${el.getAttribute(attr)}` : ''))
    .filter(Boolean)
    .join(' ');
}

function hiddenFromReaders(el: Element): boolean {
  for (let at: Element | null = el; at; at = at.parentElement) {
    if (at.getAttribute('aria-hidden') === 'true') return true;
  }
  return false;
}

// Where `disabled` is real HTML, and so takes the element out of the tab order.
// react-native-web writes it on a plain <div> too, where it means nothing at all.
const DISABLABLE = new Set(['button', 'input', 'select', 'textarea', 'fieldset', 'option']);

function nativelyDisabled(el: Element): boolean {
  return DISABLABLE.has(tagOf(el)) && el.hasAttribute('disabled');
}

function focusable(el: Element): boolean {
  if (nativelyDisabled(el)) return false;
  const index = el.getAttribute('tabindex');
  if (index !== null) return Number.parseInt(index, 10) >= 0;
  const tag = tagOf(el);
  if (tag === 'a') return el.hasAttribute('href');
  return ENTRIES.has(tag) || tag === 'button';
}

function unavailable(el: Element): boolean {
  return el.getAttribute('aria-disabled') === 'true' || nativelyDisabled(el);
}

// The activedescendant pattern: focus stays on the combobox or the listbox and
// the rows are pointed at by id, so `tabindex="-1"` on a row is the correct
// spelling of it rather than a row the keyboard cannot reach.
function ownedByActiveDescendant(el: Element): boolean {
  if (el.getAttribute('tabindex') !== '-1') return false;
  for (let at: Element | null = el.parentElement; at; at = at.parentElement) {
    if (at.hasAttribute('aria-activedescendant')) return true;
  }
  return false;
}

/** One line per element a screen reader stops on: its role, its name, its state
 * and whether the keyboard can reach it. */
function accessibleLine(el: Element): string | undefined {
  const role = roleOf(el);
  const state = stateOf(el);
  const live = el.getAttribute('aria-live');
  if (!role && !state && !live) return undefined;
  const stop = focusable(el) ? ' tab' : '';
  return `${role || tagOf(el)} "${nameOf(el).slice(0, 60)}"${state ? ` [${state}]` : ''}${stop}`;
}

function issuesOf(el: Element): readonly A11yIssue[] {
  const out: A11yIssue[] = [];
  const role = roleOf(el);
  const name = nameOf(el);
  const tag = tagOf(el);

  // An entry is `unlabelled-input`'s business, which says the same thing about
  // the same element in the terms its author can act on.
  if (CONTROLS.has(role) && !ENTRIES.has(tag) && !name && !hiddenFromReaders(el)) {
    out.push({ kind: 'nameless-control', note: `role=${role} announces as nothing` });
  }
  const wants = STATE_OF[role];
  if (wants && !el.hasAttribute(wants)) {
    out.push({ kind: 'stateless-control', note: `role=${role} carries no ${wants}` });
  }
  if (ENTRIES.has(tag) && !name) {
    out.push({ kind: 'unlabelled-input', note: `<${tag}> has no accessible name` });
  }
  const labelled = el.getAttribute('aria-labelledby');
  if (labelled) {
    const missing = labelled.split(/\s+/).filter((id) => !el.ownerDocument.getElementById(id));
    if (missing.length > 0) {
      out.push({
        kind: 'dangling-labelledby',
        note: `aria-labelledby points at ${missing.join(' ')}, which is not in the tree`,
      });
    }
  }
  const index = el.getAttribute('tabindex');
  if (index && Number.parseInt(index, 10) > 0) {
    out.push({ kind: 'positive-tabindex', note: `tabindex=${index} reorders the page` });
  }
  if (
    el.getAttribute('aria-hidden') === 'true' &&
    el.querySelector('[tabindex="0"], button, input, a[href]')
  ) {
    out.push({
      kind: 'hidden-focusable',
      note: 'hidden from readers but still reachable by keyboard',
    });
  }
  if (tag === 'img' && el.getAttribute('alt') === null) {
    out.push({ kind: 'imageless-alt', note: '<img> with no alt, not even empty' });
  }
  if (unreachable(el, role)) {
    out.push({ kind: 'unreachable-control', note: `role=${role} takes no tab stop` });
  }
  return out;
}

function unreachable(el: Element, role: string): boolean {
  if (!CONTROLS.has(role) || UNPRESSED.has(role) || focusable(el)) return false;
  if (unavailable(el) || hiddenFromReaders(el) || ownedByActiveDescendant(el)) return false;
  const style = styleOf(el);
  return style.display !== 'none' && style.pointerEvents !== 'none';
}

interface Access {
  lines: readonly string[];
  findings: readonly A11yFinding[];
}

/** The accessible tree of everything under these roots, plus what is wrong with
 * it. */
function accessOf(roots: readonly Element[]): Access {
  const lines: string[] = [];
  const findings: A11yFinding[] = [];
  for (const root of roots) {
    eachElement(root, (el, path) => {
      const line = accessibleLine(el);
      if (line) lines.push(line);
      findings.push(...issuesOf(el).map((issue) => ({ ...issue, at: path })));
    });
  }
  return { lines, findings };
}

export type { A11yKind, Access };
export { accessOf, nameOf, roleOf };
