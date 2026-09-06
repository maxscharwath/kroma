// Responsive poster grid, sizing cards to fill the row exactly. It measures its
// own width rather than the window's: inside a <Screen> the horizontal
// safe-area insets are already consumed, and window-width math overflows.
//
// Rows are a known height, so the grid also knows where every item sits: it
// reports which rows are on screen and can land a row under the safe-area top
// without a cell ever having been measured.

import { Box } from '@kroma/ui/kit';
import {
  type ReactElement,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type GridGeometry, type ItemRange, rowOffset, visibleItems } from '#mobile/lib/gridScroll';
import { spacing, TAB_BAR_CLEARANCE } from '#mobile/lib/theme';
import { type CardModel, PosterCard, posterHeight } from './cards';

const GAP = 12;

export function gridMetrics(
  width: number,
  gutterSum: number = spacing.md * 2,
): { cols: number; cardW: number } {
  let cols = 3;
  if (width >= 1000) cols = 6;
  else if (width >= 700) cols = 5;
  else if (width >= 500) cols = 4;
  const cardW = Math.floor((width - gutterSum - GAP * (cols - 1)) / cols);
  return { cols, cardW };
}

export interface PosterGridHandle {
  /** Scrolls the row holding `index` to just under the safe-area top. */
  scrollToItem(index: number): void;
}

export function PosterGrid({
  cards,
  header,
  empty,
  refreshing,
  onRefresh,
  gutters,
  ref,
  onVisibleItems,
}: Readonly<{
  cards: CardModel[];
  header?: ReactElement;
  empty?: ReactElement;
  refreshing?: boolean;
  onRefresh?: () => void;
  gutters?: { left: number; right: number };
  ref?: Ref<PosterGridHandle>;
  /** The items whose rows are on screen, each time that changes. */
  onVisibleItems?: (items: ItemRange | null) => void;
}>) {
  const insets = useSafeAreaInsets();
  const [listW, setListW] = useState<number | null>(null);
  const [headerH, setHeaderH] = useState(0);
  const list = useRef<FlatList<CardModel>>(null);
  const scroll = useRef({ y: 0, height: 0, content: 0 });
  const reported = useRef<ItemRange | null>(null);
  const pad = gutters ?? { left: spacing.md, right: spacing.md };
  const { cols, cardW } = gridMetrics(listW ?? 0, pad.left + pad.right);
  const geometry = useMemo<GridGeometry>(
    () => ({
      header: headerH,
      gap: spacing.md,
      rowH: posterHeight(cardW),
      cols,
      count: cards.length,
    }),
    [headerH, cardW, cols, cards.length],
  );

  useImperativeHandle(ref, () => ({
    scrollToItem(index) {
      const { height, content } = scroll.current;
      const top = rowOffset(geometry, Math.floor(index / cols)) - insets.top - spacing.sm;
      const offset = Math.min(Math.max(0, top), Math.max(0, content - height));
      list.current?.scrollToOffset({ offset, animated: false });
    },
  }));

  const spy = useCallback(() => {
    if (!onVisibleItems) return;
    const { y, height } = scroll.current;
    const next = height === 0 ? null : visibleItems(geometry, y + insets.top, y + height);
    const prev = reported.current;
    if (prev?.first === next?.first && prev?.last === next?.last) return;
    reported.current = next;
    onVisibleItems(next);
  }, [geometry, insets.top, onVisibleItems]);
  useEffect(() => spy(), [spy]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    scroll.current = {
      y: contentOffset.y,
      height: layoutMeasurement.height,
      content: contentSize.height,
    };
    spy();
  };

  return (
    <FlatList
      ref={list}
      key={cols}
      onLayout={(e) => {
        scroll.current.height = e.nativeEvent.layout.height;
        setListW(e.nativeEvent.layout.width);
      }}
      onContentSizeChange={(_w, h) => {
        scroll.current.content = h;
      }}
      onScroll={onScroll}
      scrollEventThrottle={32}
      data={listW === null ? [] : cards}
      numColumns={cols}
      keyExtractor={(c) => c.key}
      renderItem={({ item }) => <PosterCard card={item} width={cardW} />}
      getItemLayout={(_data, row) => ({
        length: geometry.rowH,
        offset: rowOffset(geometry, row),
        index: row,
      })}
      columnWrapperStyle={{ gap: GAP, paddingLeft: pad.left, paddingRight: pad.right }}
      contentContainerStyle={{
        paddingBottom: TAB_BAR_CLEARANCE,
        gap: spacing.md,
        flexGrow: cards.length === 0 ? 1 : undefined,
      }}
      ListHeaderComponent={
        header ? (
          <Box onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>{header}</Box>
        ) : undefined
      }
      ListEmptyComponent={listW === null ? undefined : empty}
      refreshing={refreshing}
      onRefresh={onRefresh}
      initialNumToRender={12}
      removeClippedSubviews
    />
  );
}
