// <FocusBridge> on the web: nothing.
//
// The browser focus engine is a weighted nearest-neighbour search rather than a
// strict directional band, so it already crosses the gap between two regions.
// There is nothing to bridge, and rendering an element here would risk becoming
// a containing block for the absolutely positioned screens (see
// focus-scope.web.tsx for how that goes).

import type { RefObject } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

interface FocusBridgeProps {
  to: RefObject<unknown>;
  style?: StyleProp<ViewStyle>;
}

function FocusBridge(_props: Readonly<FocusBridgeProps>) {
  return null;
}

export type { FocusBridgeProps };
export { FocusBridge };
