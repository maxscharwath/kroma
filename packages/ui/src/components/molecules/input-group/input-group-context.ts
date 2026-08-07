// What the shell tells its parts. On the web this whole component is a handful
// of `has-[]` selectors: the container reads its own contents and reshapes
// itself. There are no descendant selectors here, so every one of those
// inferences is passed down instead, computed once by the Root that already
// walks its children.

import { createContext, useContext } from 'react';
import type { ControlMetrics } from '#ui/lib/field-shell';

/** Where an addon sits. `inline` is the control's own row, `block` is a bar
 *  above or below it: a code editor's filename header, a comment box's
 *  counter and Post button. */
type AddonAlign = 'inline-start' | 'inline-end' | 'block-start' | 'block-end';

interface InputGroupContext {
  metrics: ControlMetrics;
  invalid: boolean;
  /** The padding the control itself must draw, which is the shell's own unless
   *  an addon on that side is already holding it. */
  padStart: number;
  padEnd: number;
  /** Told by the control, painted by the shell: the ring belongs to the box a
   *  reader sees, not to the input inside it. */
  onFocusChange: (focused: boolean) => void;
  /** Registered by the control so a press on the shell's padding types into
   *  it, the way a press anywhere on a <Field> does. */
  registerFocus: (focus: () => void) => void;
  focusControl: () => void;
}

const Context = createContext<InputGroupContext | null>(null);

/** What an addon tells the controls inside it. Only the side matters: a button
 *  in the shell hugs the edge it sits against, while the text beside it stays
 *  on the entry's own margin. */
const AddonContext = createContext<AddonAlign | null>(null);

function useAddonAlign(): AddonAlign | null {
  return useContext(AddonContext);
}

function useInputGroup(part: string): InputGroupContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error(`<InputGroup.${part}> must be used inside <InputGroup.Root>`);
  return ctx;
}

/** How far a control that lives INSIDE the shell sits from its edge. Small
 *  enough that the shell still reads as one box, large enough that the inner
 *  control's own focus ring is not clipped by it. */
const INSET = 4;

export type { AddonAlign, InputGroupContext };
export { AddonContext, Context, INSET, useAddonAlign, useInputGroup };
