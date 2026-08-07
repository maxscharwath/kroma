// Viewport placement for an anchored panel (a select's listbox, an action
// menu): under the trigger, clamped to the viewport, flipped above when below
// has no room to breathe. Web only - the callers are the pointer presentations.

export interface AnchorPlacement {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

import { webWindow } from '#ui/lib/dom';

export const ANCHOR_GAP = 6;
const EDGE = 12;
const MIN_ROOM = 160;

export function placeUnder(
  trigger: HTMLElement,
  at: {
    /** Panel width: the trigger's own (a select) or a fixed minimum (a menu). */
    minWidth: number;
    matchWidth?: boolean;
    maxHeight: number;
    align?: 'start' | 'end';
  },
): AnchorPlacement {
  const view = webWindow();
  const rect = trigger.getBoundingClientRect();
  const width = at.matchWidth ? Math.max(rect.width, at.minWidth) : at.minWidth;
  if (!view)
    return { left: rect.left, top: rect.bottom + ANCHOR_GAP, width, maxHeight: at.maxHeight };
  const below = view.innerHeight - rect.bottom - ANCHOR_GAP - EDGE;
  const above = rect.top - ANCHOR_GAP - EDGE;
  const flip = below < MIN_ROOM && above > below;
  const maxHeight = Math.min(at.maxHeight, Math.max(0, flip ? above : below));
  const left = at.align === 'end' ? rect.right - width : rect.left;
  return {
    left: Math.max(EDGE, Math.min(left, view.innerWidth - width - EDGE)),
    top: flip ? rect.top - ANCHOR_GAP - maxHeight : rect.bottom + ANCHOR_GAP,
    width,
    maxHeight,
  };
}
