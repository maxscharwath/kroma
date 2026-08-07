// The hand-rolled DOM entries the app still draws (a console search box, an
// entry with a button glued on) wearing the design system's own control
// shell, so a Tailwind-styled box and a kit <Field> on the same row are the
// same shape and height. Everything that IS a plain field should use <Field>
// instead of these.
//
// The numbers are LITERAL because Tailwind's scanner reads source text: an
// interpolated `rounded-[${n}px]` generates no class at all. They mirror
// `CONTROL.sm` from the kit, and `field-classes.test.ts` fails the build if
// the two ever drift.

// `surface-2` rather than a darker well: a field must read as a field on both
// surfaces it appears on: inset on a console card, and on the bare page
// behind the sign-in form, where a near-black fill left only a hairline
// border.
const EDGE =
  'min-w-0 rounded-[10px] border border-border-strong bg-surface-2 text-text outline-none transition-colors';

export const FIELD_BOX = `${EDGE} px-[14px] py-[9px] focus:border-accent`;

export const FIELD_TYPE = 'text-[13.5px] font-semibold';

export const FIELD = `${FIELD_BOX} ${FIELD_TYPE}`;

// Wraps a control (a search box with a glyph, an entry with a button glued
// on): minus vertical padding, since the control carries that so the whole
// box stays the click target. The control needs `data-focus-ring="off"` (and
// `bg-transparent outline-none`) to move the focus visual onto this box; see
// clients/web/src/styles.css.
export const FIELD_GROUP = `${EDGE} flex items-center gap-[10px] px-[14px] focus-within:border-accent`;
