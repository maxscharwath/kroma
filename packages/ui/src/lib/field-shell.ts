// THE control shell: the one well every input wears.
//
// A form puts a text entry, a select trigger, a segmented control and a search
// box on the same row, and they have to read as one family: the same corner,
// the same edge, the same fill, the same height. So the metrics are declared
// ONCE here and every control derives from them, rather than each component
// carrying its own padding and radius that drift apart the moment one is
// tuned. A one-line TextArea being exactly a TextField tall is the same rule
// applied twice.
//
// Two sizes, because two form factors read at different distances: `md` is the
// ten-foot default, `sm` is the density a console page wants. A shell that
// knows which it is states it once with `setEntryDefaults`.

import type { TextStyle } from 'react-native';
import { activeTheme, styles } from '#ui/core';

type ControlSize = 'sm' | 'md';

interface ControlMetrics {
  /** Corner, in px (a raw number so a class-string consumer can spell it too). */
  radius: number;
  px: number;
  py: number;
  /** The content row's height: what makes every control on a row line up. */
  line: number;
  fontSize: number;
  /** Gap between a leading glyph, the content and a trailing slot. */
  gap: number;
}

/** The shape of every input, per size. Read it rather than re-deriving it:
 *  this table IS the design. */
export const CONTROL: Record<ControlSize, ControlMetrics> = {
  sm: { radius: 10, px: 14, py: 9, line: 20, fontSize: 13.5, gap: 10 },
  md: { radius: 22, px: 22, py: 12, line: 24, fontSize: 16, gap: 14 },
};

/** The field's edge. Focus wins over invalid: while you are fixing the value,
 * the field should look like the thing you are working in, not like a failure. */
export function edgeColor(focused: boolean, invalid: boolean): string {
  const { colors } = activeTheme();
  if (focused) return colors.accent;
  return invalid ? colors.danger : colors.borderStrong;
}

/** A focused field wears the same amber ring as every other control, rather
 *  than a 1px edge recolour: a field is a focus target like any other and has
 *  to read as one from three metres. */
const shell = styles({ ring: { ring: 'focusLift' } });

export function fieldRing(): TextStyle {
  return shell.ring;
}

export const PLACEHOLDER = 'rgba(244, 243, 240, 0.3)';

// What an app's controls default to. Per-site props still win; this is only so
// a shell that KNOWS its form factor (the web console is a mouse-and-keyboard
// page at arm's length) says so once at startup instead of at every call site.
let entryPhysicalKeyboard = false;
let entrySize: ControlSize = 'md';

/** Shell-level defaults for the kit's inputs. Call once at startup. */
export function setEntryDefaults(
  defaults: Readonly<{ physicalKeyboard?: boolean; size?: ControlSize }>,
): void {
  if (defaults.physicalKeyboard !== undefined) entryPhysicalKeyboard = defaults.physicalKeyboard;
  if (defaults.size !== undefined) entrySize = defaults.size;
}

export function entryDefaultPhysicalKeyboard(): boolean {
  return entryPhysicalKeyboard;
}

export function entryDefaultSize(): ControlSize {
  return entrySize;
}

/** The metrics for a size, defaulting to the shell's. */
export function controlMetrics(size?: ControlSize): ControlMetrics {
  return CONTROL[size ?? entrySize];
}

/** The height of a field's content row, independent of what sits in it: the
 * entry never measures shorter than this and the glyph wells never measure
 * taller, so every field in a form lines up regardless of icons. A caller who
 * sets a bigger `textStyle` font still grows the field, which is intended -
 * what must not vary is a field's height against its own neighbours.
 *
 * It is also the unit <TextArea>'s `rows` and `maxRows` count in, which is what
 * makes a one-line TextArea and a TextField the same height. */
export const CONTENT_LINE = 24;

/** Web only, and `none` rather than width 0: Chrome's own focus ring is
 * `outline-style: auto`, which ignores the width - the field kept its blue
 * browser ring inside the kit's amber one until the STYLE was cleared. React
 * Native's types don't know `none` (native has no outline at all), hence the
 * cast. */
export const NO_OUTLINE = { outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle;

export type { ControlMetrics, ControlSize };
