// <FocusScope>: the navigator for one screen.
//
// Every screen is wrapped in one by the router, and it does two things: it holds
// the spatial tree for that screen, and it makes sure exactly ONE navigator is
// listening to the remote at a time. A screen that is pushed over another stays
// mounted underneath, and two live navigators would both act on the same press.
//
// This replaces what the OS focus engine used to do here. It used to be a
// `TVFocusGuideView autoFocus`, which the native side turns into a UIFocusGuide
// constrained to the WHOLE SCREEN - a focus candidate in every direction, so any
// press without a legitimate target was caught by it and thrown back to the
// screen's first control. That is gone: nothing on a screen is natively
// focusable any more, so there is nothing for the platform to guess at.

import type { ComponentProps, ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { useRemoteBridge } from './focus-remote';

interface FocusScopeProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface FocusColumnProps extends FocusScopeProps {
  /** Treat the rows inside as a grid: keep the column when moving between them.
   *  See <FocusColumn>. */
  grid?: boolean;
}

/** The navigator's own `style` type follows whichever react-native copy the
 * consuming app resolves (the tvos fork on a TV, mainline on the phone), and
 * those two are not assignable to each other. Flatten once, here. */
type NavigatorStyle = ComponentProps<typeof SpatialNavigationView>['style'];
const flat = (style: StyleProp<ViewStyle>[] | StyleProp<ViewStyle>): NavigatorStyle =>
  StyleSheet.flatten(style) as NavigatorStyle;

function FocusScope({ children, style }: Readonly<FocusScopeProps>) {
  useRemoteBridge();
  return (
    <SpatialNavigationRoot isActive>
      {/* The one thing tvOS focuses, and the reason the remote is heard at all.
          A directional press is delivered to the app only when the app owns the
          focus: with nothing focusable in the window the system keeps every key
          and `useTVEventHandler` never fires - measured, with a trace, twice.
          So one full-screen transparent host sits behind the content and holds
          the platform's focus, which can then never MOVE because there is
          nowhere else for it to go. Every press arrives as an event, and the
          navigator decides what it means. A Pressable rather than a View
          because that is what this fork actually makes focusable. */}
      <Pressable focusable isTVSelectable hasTVPreferredFocus style={KEY_HOST} />
      <SpatialNavigationView direction="vertical" style={flat([FILL, style])}>
        {children}
      </SpatialNavigationView>
    </SpatialNavigationRoot>
  );
}

const FILL = { flex: 1 } as const;

const KEY_HOST = StyleSheet.absoluteFill;

/**
 * <FocusRegion>: a group of controls that belong together on one line.
 *
 * The navigator moves between GROUPS vertically and inside a group
 * horizontally, so this is how a row says it is a row: the nav bar, a hero's
 * buttons, a rail. Nothing measures anything - the shape comes from the tree,
 * which is why it cannot drift when a scroll view animates or when a control
 * mounts late.
 */
function FocusRegion({ children, style }: Readonly<FocusScopeProps>) {
  return (
    <SpatialNavigationView direction="horizontal" style={flat(style)}>
      {children}
    </SpatialNavigationView>
  );
}

/**
 * <FocusColumn>: a group of controls stacked one above the other.
 *
 * The mirror of <FocusRegion>, for a block that owns its own vertical order
 * inside a screen: a list of servers, an on-screen keyboard.
 *
 * `grid` is what makes a stack of <FocusRegion> rows behave like a GRID, and it
 * is the difference between an on-screen keyboard that works and one that does
 * not. Moving between rows, the navigator lands on the row's last-focused key -
 * so Down from T went to A, and every vertical press read as a diagonal. With
 * `grid` the navigator keeps the POSITION instead: Down from the fifth key of a
 * row lands on the fifth key of the next one.
 */
function FocusColumn({ children, style, grid = false }: Readonly<FocusColumnProps>) {
  return (
    <SpatialNavigationView direction="vertical" alignInGrid={grid} style={flat(style)}>
      {children}
    </SpatialNavigationView>
  );
}

export type { FocusColumnProps, FocusScopeProps };
export { FocusColumn, FocusRegion, FocusScope };
