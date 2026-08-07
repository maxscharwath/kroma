// The machinery every anchored panel shares (a select's listbox, an action
// menu, a searchable picker): where the panel goes and how it follows its
// trigger through scrolls, who holds the DOM focus for its lifetime, and the
// roving-highlight keyboard. The panels themselves stay in their components;
// this file is only what was being written three times.

import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type AnchorPlacement, placeUnder } from '#ui/lib/anchor';
import { webWindow } from '#ui/lib/dom';
import { armEscapeGuard } from '#ui/lib/escape-guard';

// `position: fixed` rides the viewport; React Native's types don't know it.
const FIXED = 'fixed' as 'absolute';

/** The click-away layer. Above the app's sticky chrome (headers ride z-40),
 *  or a tap meant to dismiss lands on the header instead. */
export const PANEL_BACKDROP = {
  position: FIXED,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 99,
} as const;

/** The panel itself, one layer over its backdrop. */
export const PANEL_SHELL = { position: FIXED, zIndex: 100 } as const;

/**
 * Where an anchored panel goes, kept current while it is open: re-placed on
 * resize and on any scroll (capture - the scroll that moves the trigger can
 * happen in any container), coalesced to one measure per frame.
 */
export function useAnchoredPlacement(
  anchor: RefObject<unknown>,
  at: { minWidth: number; matchWidth?: boolean; maxHeight: number; align?: 'start' | 'end' },
): AnchorPlacement | null {
  const { minWidth, matchWidth = false, maxHeight, align = 'start' } = at;
  const [placement, setPlacement] = useState<AnchorPlacement | null>(null);
  // Measured before paint so the panel never flashes at 0,0.
  useLayoutEffect(() => {
    const view = webWindow();
    const trigger = anchor.current as HTMLElement | null;
    if (!view || typeof trigger?.getBoundingClientRect !== 'function') return;
    let frame = 0;
    const settle = () => {
      frame = 0;
      setPlacement(placeUnder(trigger, { minWidth, matchWidth, maxHeight, align }));
    };
    const queue = () => {
      if (frame === 0) frame = view.requestAnimationFrame(settle);
    };
    settle();
    view.addEventListener('resize', queue);
    view.addEventListener('scroll', queue, true);
    return () => {
      if (frame !== 0) view.cancelAnimationFrame(frame);
      view.removeEventListener('resize', queue);
      view.removeEventListener('scroll', queue, true);
    };
  }, [anchor, minWidth, matchWidth, maxHeight, align]);
  return placement;
}

/** The panel owns the DOM focus while open; the trigger takes it back after. */
export function usePanelFocus(panel: RefObject<unknown>, anchor: RefObject<unknown>): void {
  useEffect(() => {
    (panel.current as HTMLElement | null)?.focus?.();
    const trigger = anchor.current as HTMLElement | null;
    return () => trigger?.focus?.();
  }, [panel, anchor]);
}

export interface ListKeysAt {
  count: number;
  active: number;
  setActive: (index: number) => void;
  disabledAt?: (index: number) => boolean;
  /** Enables type-ahead: printable keys jump to the first label they start. */
  labelAt?: (index: number) => string;
  onPick: (index: number) => void;
  onClose: () => void;
}

export interface PanelKeyEvent {
  nativeEvent: { key: string };
  preventDefault: () => void;
}

/**
 * The roving-highlight keyboard of the aria-activedescendant pattern: arrows
 * move (skipping disabled rows), Home/End jump, Enter/Space pick, printable
 * keys type ahead, Esc/Tab close - with the Escape keyup swallowed so a
 * <Dialog> under the panel does not close with it.
 */
export function useListKeys(at: ListKeysAt): {
  move: (from: number, delta: -1 | 1) => void;
  onKeyDown: (event: PanelKeyEvent) => void;
} {
  const typed = useRef({ buffer: '', last: 0 });
  const live = useRef(at);
  live.current = at;

  const move = (from: number, delta: -1 | 1) => {
    const { count, disabledAt, setActive } = live.current;
    for (let i = from + delta; i >= 0 && i < count; i += delta) {
      if (!disabledAt?.(i)) {
        setActive(i);
        return;
      }
    }
  };

  const typeahead = (key: string) => {
    const { count, disabledAt, labelAt, setActive } = live.current;
    if (!labelAt) return;
    const now = Date.now();
    const state = typed.current;
    state.buffer = (now - state.last > 500 ? '' : state.buffer) + key.toLowerCase();
    state.last = now;
    for (let i = 0; i < count; i++) {
      if (!disabledAt?.(i) && labelAt(i).toLowerCase().startsWith(state.buffer)) {
        setActive(i);
        return;
      }
    }
  };

  const onKeyDown = (event: PanelKeyEvent) => {
    const key = event.nativeEvent.key;
    const { count, active, disabledAt, onPick, onClose } = live.current;
    if (key === 'ArrowDown') {
      event.preventDefault();
      move(active, 1);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      move(active, -1);
    } else if (key === 'Home') {
      event.preventDefault();
      move(-1, 1);
    } else if (key === 'End') {
      event.preventDefault();
      move(count, -1);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (!disabledAt?.(active)) onPick(active);
    } else if (key === 'Escape' || key === 'Tab') {
      event.preventDefault();
      if (key === 'Escape') armEscapeGuard();
      onClose();
    } else if (key.length === 1) {
      typeahead(key);
    }
  };

  return { move, onKeyDown };
}
