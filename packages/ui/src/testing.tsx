// Test helpers for anything that renders kit components.
//
// A <Focusable> is a node of the spatial navigator, and a node needs a navigator
// - the router gives every screen one through <FocusScope>. A test that renders
// a control on its own has no router, so it mounts the same scope here. Kept out
// of the kit's public surface: this is for tests, not for screens.

import type { ReactElement } from 'react';
import { FocusScope } from './lib/focus-scope';

/** Wrap a tree in the same navigator a real screen runs inside. */
export function onScreen(ui: ReactElement): ReactElement {
  return <FocusScope>{ui}</FocusScope>;
}
