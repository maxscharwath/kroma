// <FocusScope> on the browser targets: the navigator, and NOT a single element.
//
// The navigation is identical to the native side - same library, same rows, same
// keys (see focus-scope.tsx and focus-remote.web.ts). What differs is the box,
// and it is load-bearing rather than tidiness. Every screen root is absolutely
// positioned (`<Box fill>`), and the page landmark they sit in is deliberately
// layout-neutral with zero height. A wrapper here is `position: relative` by
// default, so it becomes those screens' containing block: they collapse to its
// zero height and their content is not painted at all. That is exactly what
// happened when this file was briefly deleted and the native <FocusScope> - which
// legitimately renders a `flex: 1` view - was used on the web too.
//
// So the screen is grouped by a NODE, which contributes an entry to the
// navigator's tree and no element to the page.

import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import {
  SpatialNavigationNode,
  SpatialNavigationRoot,
  SpatialNavigationView,
} from 'react-tv-space-navigation';
import { useRemoteBridge } from './focus-remote';

interface FocusScopeProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface FocusColumnProps extends FocusScopeProps {
  /** Treat the rows inside as a grid: keep the column when moving between them.
   *  See focus-scope.tsx for why an on-screen keyboard needs it. */
  grid?: boolean;
}

function FocusScope({ children }: Readonly<FocusScopeProps>) {
  useRemoteBridge();
  return (
    <SpatialNavigationRoot isActive>
      <SpatialNavigationNode orientation="vertical">{children as never}</SpatialNavigationNode>
    </SpatialNavigationRoot>
  );
}

/** The navigator's own `style` type follows whichever react-native copy the
 * consuming app resolves. Flatten once, here. */
const flat = (style: StyleProp<ViewStyle>[] | StyleProp<ViewStyle>) =>
  StyleSheet.flatten(style) as ViewStyle | undefined;

/** A row: the controls that belong together on one line. Identical to native. */
function FocusRegion({ children, style }: Readonly<FocusScopeProps>) {
  return (
    <SpatialNavigationView direction="horizontal" style={flat(style)}>
      {children}
    </SpatialNavigationView>
  );
}

/** A column: controls stacked one above the other, optionally a grid. Identical
 * to native. */
function FocusColumn({ children, style, grid = false }: Readonly<FocusColumnProps>) {
  return (
    <SpatialNavigationView direction="vertical" alignInGrid={grid} style={flat(style)}>
      {children}
    </SpatialNavigationView>
  );
}

export type { FocusColumnProps, FocusScopeProps };
export { FocusColumn, FocusRegion, FocusScope };
