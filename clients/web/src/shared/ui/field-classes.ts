// THE web field box: one recipe behind the hand-rolled DOM entries the app
// still draws (the console search boxes, an entry with a button glued on).
// Class strings, not components, so a one-off field can wear the same box
// without being rewritten into a primitive first. Everything that IS a plain
// field should use the design system's <Field> instead.

// `surface-2` rather than a darker well: a field must read as a field on both
// surfaces it appears on: inset on a console card, and on the bare page
// behind the sign-in form, where a near-black fill left only a hairline
// border.
const EDGE =
  'min-w-0 rounded-[9px] border border-border-strong bg-surface-2 text-text outline-none transition-colors';

export const FIELD_BOX = `${EDGE} px-3.5 py-2.25 focus:border-accent`;

export const FIELD_TYPE = 'text-[13.5px] font-semibold';

export const FIELD = `${FIELD_BOX} ${FIELD_TYPE}`;

// Wraps a control (a search box with a glyph, an entry with a button glued
// on): minus vertical padding, since the control carries that so the whole
// box stays the click target. The control needs `data-focus-ring="off"` (and
// `bg-transparent outline-none`) to move the focus visual onto this box; see
// clients/web/src/styles.css.
export const FIELD_GROUP = `${EDGE} flex items-center gap-2 px-3.5 focus-within:border-accent`;
