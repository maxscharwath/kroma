// <VirtualGrid> / <VirtualRail>: the browse surfaces that hold a whole library.
//
// A television's cost follows the number of MOUNTED controls, and a real library
// is thousands of titles. What the kit did before was defer them - render a
// chunk, render the next chunk as the focus approached the end - which keeps the
// first screen cheap and makes the last one ruinous: nothing is ever unmounted,
// so walking to the bottom of a 2000-title grid leaves 2000 tiles in the tree,
// each one a DOM subtree, a focusable node and a style recalculation on every
// move. Deferring is not virtualisation; it only postpones the bill.
//
// The reason it was deferred rather than virtualised is written in the old hook:
// the spatial navigator can only move focus to a node that EXISTS, so unmounting
// the off-screen rows would make the D-pad stop dead at the edge of the
// viewport. That is true of a plain list - and it is exactly the problem
// react-tv-space-navigation's own virtualised components solve, by registering a
// VIRTUAL node per column/slot that outlives the item rendered into it. Focus
// moves to the virtual node, the list scrolls, the real item mounts underneath
// it. So the window stays small and the remote still reaches the end of the
// library.
//
// They also fix a second thing, and it is not a side effect: a virtual column is
// registered with `useMeForIndexAlign`, which is LRUD's "keep the column". Down
// from the fourth tile of a row lands on the fourth tile of the next row instead
// of on whichever tile that row happened to be left on - the diagonal drift that
// made the grids and the on-screen keyboard feel broken.

import type { ReactElement } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import {
  SpatialNavigationVirtualizedGrid,
  SpatialNavigationVirtualizedList,
} from 'react-tv-space-navigation';

/** How many rows / items are rendered beyond the ones on screen. Two is the
 * library's default and the right trade here too: enough that a fast press does
 * not outrun the window, few enough that the window stays small. */
const OVERSCAN = 2;

interface VirtualGridProps<T> {
  data: readonly T[];
  /** Tiles per row. */
  columns: number;
  /** Row pitch in pixels: the tile's own height PLUS the gap beneath it. The
   *  list has to know this up front - it is what the scroll offsets are computed
   *  from - so a virtualised grid cannot have rows of different heights. */
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactElement;
  /** Rendered above the first row, scrolling with it. Needs `headerHeight`. */
  header?: ReactElement;
  headerHeight?: number;
  /** Applied to every row (the gap between tiles lives here). */
  rowStyle?: ViewStyle;
  /** The grid's own box on the page. It is the VIEWPORT, and it is what clips.
   *  Give it a bounded height (`flex: 1`) or nothing scrolls. */
  style?: ViewStyle;
  /** Padding around the rows. Belongs to the content, not to the viewport: on
   *  the viewport it would inset the clip and shave the rows. */
  contentStyle?: ViewStyle;
  /** Fetch the next page. Fires a few rows before the end. */
  onEndReached?: () => void;
}

/**
 * A vertically scrolling grid of fixed-size tiles, rendering only the rows near
 * the viewport. The browse screens' poster grid.
 *
 * The wrapper is load-bearing, and it is the one thing about these components
 * that is not obvious. A virtualised list does not scroll: it TRANSLATES its
 * content, and the library applies the `style` it is given to that content
 * rather than to a viewport around it. So there is no box that clips unless the
 * caller provides one - without it the rows above the resting position are drawn
 * exactly where they land, which is on top of whatever chrome sits above the
 * grid. This is that box.
 */
function VirtualGrid<T>({
  data,
  columns,
  itemHeight,
  renderItem,
  header,
  headerHeight,
  rowStyle,
  style,
  contentStyle,
  onEndReached,
}: Readonly<VirtualGridProps<T>>) {
  return (
    <View style={[styles.viewport, style]}>
      <SpatialNavigationVirtualizedGrid
        data={data as T[]}
        numberOfColumns={columns}
        itemHeight={itemHeight}
        additionalRenderedRows={OVERSCAN}
        header={header}
        headerSize={headerHeight}
        rowContainerStyle={rowStyle}
        style={contentStyle}
        onEndReached={onEndReached}
        renderItem={({ item, index }) => renderItem(item, index)}
      />
    </View>
  );
}

interface VirtualRailProps<T> {
  data: readonly T[];
  /** Tile pitch in pixels: the tile's own width PLUS the gap after it. */
  itemWidth: number;
  renderItem: (item: T, index: number) => ReactElement;
  /** The row's own box on the page: the viewport that clips. Needs a height. */
  style?: ViewStyle;
  /** Padding around the tiles, applied to the translated content. */
  contentStyle?: ViewStyle;
  onEndReached?: () => void;
}

/**
 * A horizontally scrolling row of fixed-size tiles, rendering only the ones near
 * the viewport. The home screen's rails.
 *
 * Unlike <Rail> this draws no title and no padding: it is the row itself, so the
 * caller keeps the chrome around it and this stays the one thing that has to
 * know about item sizes.
 */
function VirtualRail<T>({
  data,
  itemWidth,
  renderItem,
  style,
  contentStyle,
  onEndReached,
}: Readonly<VirtualRailProps<T>>) {
  return (
    <View style={[styles.viewport, style]}>
      <SpatialNavigationVirtualizedList
        data={data as T[]}
        itemSize={itemWidth}
        orientation="horizontal"
        additionalItemsRendered={OVERSCAN}
        style={contentStyle}
        onEndReached={onEndReached}
        renderItem={({ item, index }) => renderItem(item, index)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** See <VirtualGrid>: the list translates its content, so this is the only
   * thing that clips it. */
  viewport: { overflow: 'hidden' },
});

export type { VirtualGridProps, VirtualRailProps };
export { VirtualGrid, VirtualRail };
