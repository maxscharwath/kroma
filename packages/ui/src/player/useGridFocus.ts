import type { RemoteKey } from '@kroma/core';
import { useCallback, useState } from 'react';

/**
 * Reusable 2-D focus for a card grid (the "À suivre" up-next sheet, §10). ▲▼◀▶
 * move a flat index across a fixed column count; ▲ off the top row calls
 * `onExit('top')` so the sheet can close, and hover moves focus like the D-pad.
 */
export interface GridFocusOptions {
  count: number;
  cols: number;
  initial?: number;
  onActivate?: (index: number) => void;
  onBack?: () => void;
  onExit?: (edge: 'top' | 'bottom') => void;
}

export interface GridFocus {
  index: number;
  setIndex: (i: number) => void;
  onKey: (key: RemoteKey) => boolean;
  hover: (i: number) => () => void;
}

export function useGridFocus(opts: GridFocusOptions): GridFocus {
  const { count, cols, onActivate, onBack, onExit } = opts;
  const [index, setIndex] = useState(opts.initial ?? 0);

  const onKey = useCallback(
    (key: RemoteKey): boolean => {
      if (count === 0) {
        if (key === 'Up') {
          onExit?.('top');
          return onExit != null;
        }
        if (key === 'Back') {
          onBack?.();
          return onBack != null;
        }
        return false;
      }
      const col = index % cols;
      if (key === 'Left') {
        if (col === 0) return true;
        setIndex(index - 1);
        return true;
      }
      if (key === 'Right') {
        if (col === cols - 1 || index + 1 >= count) return true;
        setIndex(index + 1);
        return true;
      }
      if (key === 'Up') {
        if (index - cols < 0) {
          onExit?.('top');
          return onExit != null;
        }
        setIndex(index - cols);
        return true;
      }
      if (key === 'Down') {
        const next = index + cols;
        if (next >= count) {
          onExit?.('bottom');
          return onExit != null;
        }
        setIndex(next);
        return true;
      }
      if (key === 'Enter') {
        onActivate?.(index);
        return onActivate != null;
      }
      if (key === 'Back') {
        onBack?.();
        return onBack != null;
      }
      return false;
    },
    [index, count, cols, onActivate, onBack, onExit],
  );

  const hover = useCallback((i: number) => () => setIndex(i), []);

  return { index, setIndex, onKey, hover };
}
