import type { SpatialNavigator } from '@kroma/spatial-nav';

interface FocusQueue {
  request: (id: string) => void;
  claim: (id: string) => void;
  flush: () => void;
}

/**
 * Focus asked for before the tree it names is whole. A node registers in its
 * mount effect and its parent registers after it, so focus asked for on mount
 * lands on a node the navigator is still holding for a parent that has not
 * arrived. The root flushes this after every commit, which is where the tree
 * always is complete.
 */
function focusQueue(navigator: SpatialNavigator): FocusQueue {
  let pending: string | null = null;
  let forced = false;

  return {
    request(id) {
      if (navigator.focus(id)) return;
      pending = id;
      forced = true;
    },
    claim(id) {
      if (navigator.focusedId || pending) return;
      if (navigator.focus(id)) return;
      pending = id;
    },
    flush() {
      const id = pending;
      const wanted = forced;
      pending = null;
      forced = false;
      if (!id) return;
      if (!wanted && navigator.focusedId) return;
      navigator.focus(id);
    },
  };
}

export type { FocusQueue };
export { focusQueue };
