// <FocusScroll> and <FocusSlot>: the page, scrolled by the focus, one ROW at a
// time.
//
// Nothing on a screen is focusable to the platform any more (see <FocusScope>),
// so no OS scrolls anything into view: the navigator knows where the focus went
// and the page has to follow it from there. That part is not new - what is new
// is WHAT the page follows.
//
// It follows the row, not the control. The navigator's own scroller aligns the
// focused CONTROL near the top of the screen, and a control near the bottom of a
// tall block drags everything above it off the screen for good: the home hero's
// buttons sit near the bottom of a 691pt picture, so landing on them scrolls the
// title and the artwork away, and coming back up from the rails aligns those
// same buttons exactly the same way. Nothing is wrong as far as the navigator is
// concerned, and the hero never comes back.
//
// So a page scrolls by row: a row is a <FocusSlot>, and the page always shows it
// from its own top. A control that is in no row is its own row, which is what a
// settings list and a grid cell are.

import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useRef,
} from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SpatialNavigationNode } from 'react-tv-space-navigation';

/** The browser targets (Tizen, webOS, desktop) resolve react-native to
 * react-native-web. */
const WEB = Platform.OS === 'web';

/** Something the page can be asked to show: a row, or a control that is one. */
type Anchor = RefObject<View | null>;

/** How the enclosing page is asked to show an anchor. Null outside one. */
const PageScrollContext = createContext<((anchor: Anchor) => void) | null>(null);

/** The row a control belongs to, if any. */
const RowContext = createContext<Anchor | null>(null);

/**
 * How the enclosing RAIL is asked to show a control. Null outside one.
 *
 * Separate from the page because the two axes want different things: down the
 * page you want the whole ROW (the rail with its heading, the hero with its
 * title), along a rail you want the TILE. A control inside a rail is inside both
 * and asks both.
 *
 * This exists at all because the navigator's own scroller cannot be used here.
 * It scrolls by measuring the focused element through a ref it installs itself,
 * and <Focusable> has to put its own ref on that same view (React 19 spreads
 * `ref` like any other prop, and the last one wins) - so the library's ref was
 * always null and every rail silently stayed at scrollLeft 0 while the focus
 * walked off the side of the screen. Owning the scroll means owning the ref, and
 * there is exactly one of them.
 */
const RailScrollContext = createContext<((anchor: Anchor) => void) | null>(null);

/** The style type follows whichever react-native copy the consuming app resolves
 * (the tvos fork on a TV, mainline on the phone), and those two are not
 * assignable to each other. Flatten once, here. */
const flat = (style: StyleProp<ViewStyle>): ViewStyle | undefined =>
  StyleSheet.flatten(style) as ViewStyle | undefined;

interface PageMetrics {
  /** Where the anchor's top sits in the content, in points. */
  top: number;
  /** How far below the viewport's top edge the anchor should come to rest. */
  offsetFromStart: number;
  /** The scroller's own height. */
  viewport: number;
  /** The height of everything inside it. */
  content: number;
}

/**
 * Where the page must sit for the content at `top` to rest `offsetFromStart`
 * below the viewport's top edge - never above the content's first pixel, never
 * past its last screenful. This is the whole of the scrolling policy, and the
 * clamps are what make a row taller than its offset (the hero) show whole.
 */
function pageOffset({ top, offsetFromStart, viewport, content }: PageMetrics): number {
  const last = Math.max(0, content - viewport);
  return Math.min(Math.max(top - offsetFromStart, 0), last);
}

interface FocusScrollProps {
  children: ReactNode;
  /** The scroller's own box. It needs a bounded height, or nothing clips. */
  style?: StyleProp<ViewStyle>;
  /** The padding belongs here, on the CONTENT: on the box it would pad the
   *  viewport and clip the last row instead of the list. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Keeps the focused row off the very edge, so there is always a hint of what
   *  comes before it. */
  offsetFromStart?: number;
}

function FocusScroll({
  children,
  style,
  contentStyle,
  offsetFromStart = 0,
}: Readonly<FocusScrollProps>) {
  const scroller = useRef<ScrollView>(null);
  // The scroller's CONTENT view, which is what a row is measured against.
  //
  // React Native hands it over through `innerViewRef`, and it has to be the view
  // itself: on the new architecture the older `getInnerViewNode()` answers with a
  // legacy numeric tag that `measureLayout` accepts and then silently ignores -
  // no measurement, no callback, no error, and a page that simply never scrolls.
  // react-native-web has no such prop and returns the element from that same
  // call, where it works, which is what the fallback is for.
  const inner = useRef<View>(null);
  // Measured rather than assumed: the clamps need both, and a page grows as its
  // rails mount.
  const page = useRef({ viewport: 0, content: 0 });
  // The row the page was last asked to show, which is the one the focus is in.
  const showing = useRef<Anchor | null>(null);

  const reveal = useCallback(
    (anchor: Anchor) => {
      showing.current = anchor;
      const target = anchor.current;
      // The content VIEW, not the scroller's own box: a row measured against the
      // box would be measured from the viewport's edge, which moves as the page
      // scrolls. Against the content it comes back in the coordinates a scroll
      // offset is expressed in.
      const measuredAgainst = inner.current ?? scroller.current?.getInnerViewNode();
      if (!target || !measuredAgainst) return;
      target.measureLayout(
        measuredAgainst,
        (_left, top) => {
          const { viewport, content } = page.current;
          scroller.current?.scrollTo({
            y: pageOffset({ top, offsetFromStart, viewport, content }),
            animated: true,
          });
        },
        // Measuring a view on its way out fails, and that is not an error: the
        // screen it belonged to is gone, and so is the scroll it asked for.
        () => {},
      );
    },
    [offsetFromStart],
  );

  return (
    <PageScrollContext.Provider value={reveal}>
      <ScrollView
        ref={scroller}
        // React 19 types a ref as nullable; React Native's prop does not.
        innerViewRef={inner as RefObject<View>}
        style={flat(style)}
        contentContainerStyle={flat(contentStyle)}
        showsVerticalScrollIndicator={false}
        onLayout={(e: LayoutChangeEvent) => {
          page.current.viewport = e.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_width: number, height: number) => {
          page.current.content = height;
          // And show the focused row again, because until now the page may not
          // have been long enough to bring it where it belongs: a screen mounts
          // its rows as the focus comes down to them (see <FocusSlot>), so the
          // row that is being scrolled to is regularly the one that just made
          // the page taller.
          if (showing.current) reveal(showing.current);
        }}
        // The focus drives this scroller. A human drives it too wherever there is
        // a wheel or a trackpad - a browser, the desktop shell - and a television
        // has neither, where a scrollable view is only one more thing for the
        // platform to try to focus.
        scrollEnabled={WEB}
      >
        {children}
      </ScrollView>
    </PageScrollContext.Provider>
  );
}

/**
 * <FocusRail>: one rail, scrolled sideways by the focus.
 *
 * The mirror of <FocusScroll> on the other axis, and deliberately the same
 * policy expressed twice rather than one component with a flag: what the two
 * scroll TO differs (a row versus a tile), and that is the interesting part.
 *
 * A rail sits inside a page, so both are live at once: moving Right scrolls the
 * rail to the next tile, moving Down out of it scrolls the page to the next row.
 * Neither knows about the other; a control simply asks both (see
 * {@link useRevealOnFocus}).
 */
function FocusRail({
  children,
  style,
  contentStyle,
  offsetFromStart = 0,
}: Readonly<FocusScrollProps>) {
  const scroller = useRef<ScrollView>(null);
  const inner = useRef<View>(null);
  const rail = useRef({ viewport: 0, content: 0 });
  const showing = useRef<Anchor | null>(null);

  const reveal = useCallback(
    (anchor: Anchor) => {
      showing.current = anchor;
      const target = anchor.current;
      const measuredAgainst = inner.current ?? scroller.current?.getInnerViewNode();
      if (!target || !measuredAgainst) return;
      target.measureLayout(
        measuredAgainst,
        (left) => {
          const { viewport, content } = rail.current;
          scroller.current?.scrollTo({
            x: pageOffset({ top: left, offsetFromStart, viewport, content }),
            animated: true,
          });
        },
        () => {},
      );
    },
    [offsetFromStart],
  );

  return (
    <RailScrollContext.Provider value={reveal}>
      <ScrollView
        ref={scroller}
        horizontal
        // React 19 types a ref as nullable; React Native's prop does not.
        innerViewRef={inner as RefObject<View>}
        style={flat(style)}
        contentContainerStyle={flat(contentStyle)}
        showsHorizontalScrollIndicator={false}
        onLayout={(e: LayoutChangeEvent) => {
          rail.current.viewport = e.nativeEvent.layout.width;
        }}
        onContentSizeChange={(width: number) => {
          rail.current.content = width;
          // A rail grows as its tiles arrive, so the tile the focus is on is
          // regularly the one that just made the row wider - and until it did,
          // there was nowhere to scroll it to.
          if (showing.current) reveal(showing.current);
        }}
        scrollEnabled={WEB}
      >
        {children}
      </ScrollView>
    </RailScrollContext.Provider>
  );
}

/**
 * <FocusSlot>: one row of a page.
 *
 * Two things, both of which a row of a page needs.
 *
 * It is a permanent place in the navigator's ORDER. The navigator registers
 * nodes as they mount, and a screen's rows do not mount in the order you see
 * them - the hero waits for the server, a rail waits for its section, "Reprendre
 * la lecture" waits for the resume list. Left alone, Up from the hero walks into
 * the rail below it because that rail was registered first. A slot keyed by
 * position fixes the order at first render and lets the content arrive whenever
 * it likes.
 *
 * And it is what the page SCROLLS to. Whichever control inside it takes the
 * focus, the page shows the row from its top: the hero with its title, a rail
 * with its heading.
 */
function FocusSlot({
  children,
  onActive,
}: Readonly<{ children: ReactNode; onActive?: () => void }>) {
  const row = useRef<View>(null);
  return (
    <SpatialNavigationNode onActive={onActive}>
      <RowContext.Provider value={row}>
        {/* A plain box around the row, and the one thing the page measures. It
            adds no layout of its own: a column that stretches its child. */}
        <View ref={row}>{children}</View>
      </RowContext.Provider>
    </SpatialNavigationNode>
  );
}

/**
 * What a control uses to ask to be shown when it takes the focus.
 *
 * Both axes, and they want different things. The PAGE shows the ROW the control
 * belongs to - the whole hero, the whole rail with its heading - and the
 * control's own box only when it is in no row, which is what a settings list and
 * a grid cell are. The RAIL shows the control itself, because along a row the
 * tile IS the unit. A control inside a rail inside a page asks both and neither
 * has to know about the other; outside either, that half does nothing.
 */
function useRevealOnFocus(self: Anchor): () => void {
  const page = useContext(PageScrollContext);
  const rail = useContext(RailScrollContext);
  const row = useContext(RowContext);
  return useCallback(() => {
    rail?.(self);
    page?.(row ?? self);
  }, [page, rail, row, self]);
}

export type { Anchor, FocusScrollProps, PageMetrics };
export { FocusRail, FocusScroll, FocusSlot, pageOffset, useRevealOnFocus };
