// <VirtualRail>: the horizontally scrolling row of the browse screens.
//
// It owns three things, and each of them is owned for a measured reason.
//
// THE MOTION. On the browser targets the row moves with a CSS transition, not
// with `Animated`. react-native-web has no native animated module - it says so
// out loud, "useNativeDriver is not supported ... falling back to JS-based
// animation" - so every Animated value is a requestAnimationFrame loop writing
// an inline style each frame, competing with React for the same main thread.
// Two of those (this row's and the navigator library's) is what "laggy" was. A
// transition hands the whole thing to the compositor: one style write, zero JS
// per frame. Native keeps Animated, where the native driver is real.
//
// THE OFFSET. Where the row sits is a rule the library cannot express: the
// highlight travels across the middle and the row moves only when the selection
// comes within a margin of an end, which depends on where the row already is.
// That is `edge-scroll.ts`, tested on its own.
//
// THE WINDOW, and this is the constraint everything else bends around. LRUD
// orders siblings by REGISTRATION and `SpatialNavigationNode` cannot declare an
// index, so a tile that mounts at the head of a sliding window registers LAST
// and walking left dies at the window's edge (measured, twice, before this note
// existed). The row therefore GROWS and never shrinks: tiles are mounted from
// the start of the data up to the furthest the selection has reached, so every
// tile the D-pad can move to is one that was mounted in order. The cost is
// bounded by how far someone actually walks a row - a screenful to start with,
// and a rail is not a 2000-item grid. <VirtualGrid> keeps the library's
// virtualisation, where the window has to be a window.

import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SpatialNavigationView } from 'react-tv-space-navigation';
import { Icon } from '#ui/components/atoms/icon';
import { gradient, maskImage } from '#ui/lib/css';
import { webDocument } from '#ui/lib/dom';
import { FocusReporter } from '#ui/lib/focus-report';
import { colors, motion, radius, SHADE, shadow } from '#ui/lib/tokens';
import { useWheelPan } from '#ui/lib/wheel-pan';
import { clipStyles, FOCUS_BLEED, OVERSCAN } from './clip';
import { edgeScrollOffset, fitPitch } from './edge-scroll';

const WEB = Platform.OS === 'web';
/** A screen someone SCROLLS WITH A THUMB: the phones and the tablets, where the
 * row's other two inputs (a D-pad walking focus, a wheel under a pointer) do not
 * exist and the row would otherwise be frozen scenery. */
const TOUCH = !WEB && !Platform.isTV;

/**
 * The horizontal padding a content style spends, in pixels.
 *
 * Percentages and other non-numeric lengths are ignored rather than guessed at:
 * the pitch maths needs a number, and being wrong by an unknown amount is worse
 * than being wrong by a padding nobody used. Longhands win over the shorthand,
 * which is React Native's own precedence.
 */
function horizontalInset(style: ViewStyle | undefined): number {
  if (!style) return 0;
  const both = typeof style.paddingHorizontal === 'number' ? style.paddingHorizontal : 0;
  const left = typeof style.paddingLeft === 'number' ? style.paddingLeft : both;
  const right = typeof style.paddingRight === 'number' ? style.paddingRight : both;
  return left + right;
}

/** How the row settles. Short, because this is a cursor moving rather than a
 * transition, and long enough to read as movement rather than a cut. */
const SETTLE_MS = motion.duration.fast;
const [x1, y1, x2, y2] = motion.bezier.out;
const EASE_CSS = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
const EASE_NATIVE = Easing.bezier(x1, y1, x2, y2);

/** How long a press stays "the reason" for a focus change. Generous: the
 * navigator resolves the move, mounts what it needs and only then does the tile
 * report - all after the keydown, and all before a human presses again. */
const KEY_GRACE_MS = 400;

/** The keys that mean "move the selection", on every remote the shells see. */
const DIRECTIONS = new Set(['ArrowLeft', 'ArrowRight', 'Left', 'Right']);

/** How long after the last wheel tick the row answers the pointer again. Long
 * enough to cover the gap between ticks of one gesture, short enough that a
 * click straight after a scroll still lands. */
const PAN_SETTLE_MS = 180;

/**
 * How long the fade at each end is, for a row of this width. The scrimmed strip
 * is that plus the bleed it holds opaque, and the control sits inside it.
 *
 * PROPORTIONAL, and that is the fix. It was a constant 92, which is 5% of a
 * 1920pt television row and quite invisible - but the workbench's `fit` stage
 * clamps this story to 560, where the same 92 is 17% of the row and lands as a
 * black slab across a sixth of it. A constant cannot be right for both, so it is
 * a fraction of the row, floored so it never gets too thin to read as a fade and
 * capped so a 4K row does not lose a hand's width at each end.
 */
function edgeWidth(row: number): number {
  if (row <= 0) return EDGE_MIN;
  return Math.round(Math.min(EDGE_MAX, Math.max(EDGE_MIN, row * EDGE_SHARE)));
}

/** How far the row can travel: everything it holds, less what fits. One
 * definition, because a row whose clamp bound and whose snap bound disagree is
 * exactly how an offset drifts off the pitch grid - the failure the rest of this
 * file is written to prevent. */
function maxOffset(count: number, pitch: number, room: number): number {
  return Math.max(0, count * pitch - room);
}

/** A seventh of the row, and generous on purpose: an alpha ramp is only as soft
 *  as the distance it has to travel, and the short versions (5%, then 10%) both
 *  read as a band with an edge rather than as the row going quietly away. */
const EDGE_SHARE = 0.15;
const EDGE_MIN = 88;
const EDGE_MAX = 300;
/** How far the control sits from the row's very edge. */
const EDGE_INSET = 8;
/**
 * The shape of the fade: how VISIBLE the row is at each fraction of the fade's
 * length, from nothing at the outer edge to all of it inside.
 *
 * `smootherstep(t)`, sampled every eighth or so, and the samples are the whole
 * point - both a mask and a gradient interpolate LINEARLY between stops, so the
 * curve has to be drawn rather than described. Two stops of a straight ramp is
 * what "too sharp" was: it leaves the edge at its steepest, which the eye reads
 * as a boundary (it is far more sensitive to the first few percent of black than
 * to the last few) and which bands on a dark surface. A smootherstep leaves 0
 * flat and arrives at 1 flat, so there is nothing to see at either end - only in
 * the middle, where the row is already half gone and a fast change is invisible.
 */
const FADE_CURVE = [
  [0, 0],
  [0.12, 0.01],
  [0.25, 0.1],
  [0.4, 0.32],
  [0.55, 0.59],
  [0.7, 0.84],
  [0.85, 0.97],
  [1, 1],
] as const;

/** A mask alpha at a distance from the START of the clip box. */
function fadeIn(alpha: number, t: number, fade: number): string {
  return `rgba(0, 0, 0, ${alpha}) ${Math.round(FOCUS_BLEED + t * fade)}px`;
}

/**
 * The row's ends, as a MASK on the box that clips it.
 *
 * A mask rather than a scrim, and that is the fix. The scrim was the page colour
 * painted OVER the row - which only disappears where the page is exactly that
 * colour, and the strip is not the row: it reaches `FOCUS_BLEED` past it on every
 * side (it has to, or the end tiles' focus rings are shaved), so it also lay over
 * the rail's own title and washed the first word of it out. A mask has neither
 * problem, because it removes the row's OWN pixels: nothing is painted, nothing
 * outside the clip box can be dimmed by it, and the tiles fade to whatever is
 * actually behind them rather than to one hardcoded colour.
 *
 * The bleed is masked out entirely: what is painted there is a tile sliced by the
 * clip, which is the artefact all of this exists to hide. The fade proper starts
 * at the row's own edge, where the tiles do, and stops are in PIXELS so the bleed
 * is a prefix rather than a stretch of the curve.
 *
 * An end that cannot scroll is NOT faded - the first tile's focus ring lives in
 * that bleed, and fading it is how the ring got shaved before `FOCUS_BLEED`
 * existed. It switches rather than transitions (mask images do not interpolate),
 * which is invisible in practice: the switch happens on the frame the row starts
 * or stops moving.
 */
function railMask(fade: number, start: boolean, end: boolean): string {
  const stops: string[] = [];
  if (start) {
    // Empty from the clip's edge to the row's, then the curve. The first sample
    // IS the row's edge, at zero, so the flat part needs one stop of its own.
    stops.push('rgba(0, 0, 0, 0) 0px');
    for (const [t, alpha] of FADE_CURVE) stops.push(fadeIn(alpha, t, fade));
  } else stops.push('rgba(0, 0, 0, 1) 0px');
  if (end) {
    // Mirrored: the same curve read from the far edge back, in `calc` so it does
    // not need the row's width - which this string is written without.
    for (let at = FADE_CURVE.length - 1; at >= 0; at--) {
      const [t, alpha] = FADE_CURVE[at] ?? [0, 0];
      stops.push(`rgba(0, 0, 0, ${alpha}) calc(100% - ${Math.round(FOCUS_BLEED + t * fade)}px)`);
    }
    stops.push('rgba(0, 0, 0, 0) 100%');
  } else stops.push('rgba(0, 0, 0, 1) 100%');
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/**
 * The same fade, painted, for native - where there is no mask (see `maskImage`).
 *
 * The page colour over the row rather than the row taken away, with the ends of
 * the curve swapped round: it is opaque where the mask is empty. Same geometry,
 * same samples, and the same reason for each of them.
 */
function scrim(start: boolean, fade: number): string {
  const stops = FADE_CURVE.map(
    ([t, visible]) =>
      `rgba(10, 10, 12, ${Number((1 - visible).toFixed(2))}) ${Math.round(FOCUS_BLEED + t * fade)}px`,
  );
  return `linear-gradient(to ${start ? 'right' : 'left'}, ${SHADE.full} 0px, ${stops.join(', ')})`;
}
/**
 * `gradient(scrim(...))` for a side and a fade length, built once.
 *
 * Native only, and the reason is the target: `RailEdge` is not memoised and is
 * mounted twice, so on a television every D-pad move that scrolls the row was
 * re-mapping the eight-sample curve and minting two style objects. The inputs
 * are a boolean and a width that only changes on resize, so the whole thing is a
 * two-entry lookup in practice.
 */
const scrims = new Map<string, ViewStyle>();

function scrimStyle(start: boolean, fade: number): ViewStyle {
  const key = `${start}:${fade}`;
  const hit = scrims.get(key);
  if (hit) return hit;
  const style = gradient(scrim(start, fade)) as ViewStyle;
  scrims.set(key, style);
  return style;
}

/** The arrows fade with the pointer rather than blinking in and out. */
const FADE = {
  transitionProperty: 'opacity',
  transitionDuration: `${SETTLE_MS}ms`,
  transitionTimingFunction: EASE_CSS,
};

interface VirtualRailProps<T> {
  data: readonly T[];
  /** Tile pitch in pixels: the tile's own width PLUS the gap after it. It is a
   *  TARGET - the row fits a whole number of tiles into the width it is given,
   *  so a 10-foot pitch in a phone becomes three tiles rather than two and a
   *  sliced one. Tiles should therefore fill their cell (`width: '100%'`). */
  itemWidth: number;
  renderItem: (item: T, index: number) => ReactElement;
  /** The space BETWEEN tiles, as padding inside each pitch cell. It belongs here
   *  rather than in a wrapper the caller renders: the cell already exists, and a
   *  second view per tile purely to hold a padding doubles the mounted-control
   *  count - which is the number a television's frame time follows. */
  gap?: number;
  /** The row's own box on the page: the viewport that clips. Needs a height. */
  style?: ViewStyle;
  /** Padding around the tiles, applied to the row that moves. */
  contentStyle?: ViewStyle;
  /** Fetch the next page. Fires a couple of tiles before the end. */
  onEndReached?: () => void;
  /**
   * Look-ahead kept past the selection, in TILES, before the row starts moving.
   * One reads best: there is always a tile visible beyond the highlight, so the
   * row shows where you are about to go. Zero means "move only once the
   * selection is flush against the edge".
   */
  edgeMargin?: number;
  /** Let a mouse wheel / trackpad pan the row (web). It never moves the
   *  selection - see `wheel-pan.web.ts`. */
  wheel?: boolean;
  /** Show the pointer's own way to page the row: an arrow at each end, on hover.
   *  Web only, and never a focus stop - a remote already has two buttons for
   *  this, and an arrow it could land on would be one more thing in its way. */
  arrows?: boolean;
}

function VirtualRail<T>({
  data,
  itemWidth,
  renderItem,
  gap = 0,
  style,
  contentStyle,
  onEndReached,
  edgeMargin = 1,
  wheel = true,
  arrows = true,
}: Readonly<VirtualRailProps<T>>) {
  const viewport = useRef<View | null>(null);
  const [offset, setOffset] = useState(0);
  /** The furthest tile mounted. Grows with what has been REACHED - by the
   *  selection or by a pan - and never shrinks. */
  const [reach, setReach] = useState(OVERSCAN);
  /** A wheel pan tracks the gesture exactly: no transition while it runs. */
  const [panning, setPanning] = useState(false);
  /** The arrows are for the pointer, so they appear when the pointer does. */
  const [hovered, setHovered] = useState(false);

  // The offset is state (the transform renders from it) and a ref (a pan adds to
  // it between renders, and a wheel delivers faster than React commits).
  const at = useRef(0);
  const measured = useRef(0);
  /** When a direction key was last pressed. A focus change that does NOT follow
   *  one came from the cursor. */
  const keyAt = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(settle.current), []);

  // Capture phase: react-native-web's TextInput stops propagation on keydown, so
  // a bubbling listener would miss every press made while a field holds focus.
  useEffect(() => {
    // `webDocument()` rather than the global: it is the one sanctioned way for
    // shared code to ask for the DOM, and it returns null on a television instead
    // of throwing a ReferenceError that React turns into a crash. See lib/dom.
    const dom = webDocument();
    if (!WEB || !dom) return;
    const onKey = (e: KeyboardEvent) => {
      if (DIRECTIONS.has(e.key)) keyAt.current = Date.now();
    };
    dom.addEventListener('keydown', onKey, true);
    return () => dom.removeEventListener('keydown', onKey, true);
  }, []);

  const count = data.length;
  /** How much of the row's width `contentStyle` spends on padding. The tiles get
   *  what is left, and that is the width the pitch has to divide. */
  const contentInset = useMemo(() => horizontalInset(contentStyle), [contentStyle]);
  /**
   * The row's own width, as state as well as a ref.
   *
   * The ref is for the callbacks, which need it synchronously; the state is what
   * makes the PITCH below a derivation rather than a copy.
   */
  const [width, setWidth] = useState(0);
  /**
   * Everything below counts in PITCHES, and the pitch is what fits: `fitPitch`
   * stretches the authored width so a whole number of tiles fills the row exactly.
   *
   * DERIVED, and that is a fix rather than a tidy-up. It used to be state written
   * only by `onLayout`, so it went stale the moment `itemWidth` changed without a
   * resize: the tiles redrew at the new width inside slots still sized by the old
   * pitch, and because the row's offset is counted in pitches while
   * `edgeScrollOffset` only nudges an offset that has fallen outside its margin
   * window, an off-grid offset was never corrected. Both ends kept a sliced tile
   * for the rest of the session.
   */
  const pitch = width > 0 ? fitPitch(itemWidth, width) : itemWidth;
  /** The edge fade, sized from the row. See `edgeWidth`. */
  const edge = edgeWidth(width);

  /** Mount up to `index`, and never fewer than before. */
  const grow = useCallback(
    (index: number) => setReach((prev) => (index > prev ? Math.min(count - 1, index) : prev)),
    [count],
  );

  /** A tile took the focus: the row moves only if the selection is coming within
   *  a margin of an end. */
  const select = useCallback(
    (index: number) => {
      setPanning(false);
      grow(index + OVERSCAN);
      if (index >= count - 1 - OVERSCAN) onEndReached?.();
      // Only a PRESS moves the row. The navigator focuses whatever the cursor
      // enters, so scrolling on every focus change meant the row crept sideways
      // whenever the pointer wandered near an end; a pointer user says where the
      // row goes with the arrows or the wheel. Keyed off the press rather than
      // off "the pointer moved recently", because the focus change can land
      // after any grace window you pick - and off nothing at all on the
      // televisions, where a remote is the only input there is.
      if (WEB && Date.now() - keyAt.current > KEY_GRACE_MS) return;
      // On a touchscreen the ScrollView owns the position outright: a tap that
      // focused a tile yanking the row underneath it is the drawer-thumb bug in
      // sideways clothing.
      if (TOUCH) return;
      at.current = edgeScrollOffset({
        offset: at.current,
        index,
        itemSize: pitch,
        viewport: measured.current,
        count,
        margin: edgeMargin * pitch,
      });
      setOffset(at.current);
    },
    [count, edgeMargin, grow, onEndReached, pitch],
  );
  // The tiles close over this rather than over `select`, so growing the row does
  // not rebuild every tile that was already in it.
  const selectRef = useRef(select);
  selectRef.current = select;

  /** The wheel pans the row and leaves the selection alone - but the row still
   *  has to grow, or a pan runs off the end of what is mounted into blank space.
   *  What a pan reveals is mounted, exactly as if the selection had gone there. */
  const panBy = useCallback(
    (delta: number, instant: boolean) => {
      const furthest = maxOffset(count, pitch, measured.current);
      at.current = Math.round(Math.min(furthest, Math.max(0, at.current + delta)));
      setOffset(at.current);
      grow(Math.ceil((at.current + measured.current) / pitch) + OVERSCAN);
      // The row stops answering the pointer while it moves under one: in pointer
      // mode the navigator focuses whatever the cursor ENTERS, and the cursor
      // does not have to move for that - the tiles move under it.
      setPanning(instant);
      clearTimeout(settle.current);
      settle.current = setTimeout(() => setPanning(false), PAN_SETTLE_MS);
    },
    [count, grow, pitch],
  );

  const pan = useCallback((delta: number) => panBy(delta, true), [panBy]);
  useWheelPan(viewport, pan, wheel);

  /** The thumb's gesture, reported by the ScrollView that owns it on touch. The
   * row's own bookkeeping still has to happen - the reach grows so a fling never
   * runs into unmounted blank, the offset feeds the edge fades, and the end of
   * the row still asks for the next page. */
  const onTouchScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = Math.round(event.nativeEvent.contentOffset.x);
      at.current = x;
      setOffset(x);
      grow(Math.ceil((x + measured.current) / pitch) + OVERSCAN);
      if (x >= maxOffset(count, pitch, measured.current) - OVERSCAN * pitch) onEndReached?.();
    },
    [count, grow, onEndReached, pitch],
  );

  /** One arrow press moves a screenful less a tile, so the row overlaps itself
   *  by one and nothing is skipped over. */
  const page = useCallback(
    // In PITCHES, not in `itemWidth`. The pitch is what a tile actually occupies
    // (`fitPitch` stretches the authored width so a whole number of them fills the
    // row), so paging by `itemWidth` left the row a fraction of a tile out of step
    // on every press - and the dependency list said `pitch` while the body read
    // `itemWidth`, so after the control changed it paged by a stale one.
    (direction: 1 | -1) => panBy(direction * Math.max(pitch, measured.current - pitch), false),
    [panBy, pitch],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      // The CONTENT strip, not the view. `onLayout` measures the outer view, but
      // the tiles are laid out inside `contentStyle`'s horizontal padding - so
      // dividing the outer width into whole pitches put a whole row's worth of
      // tiles into a strip that many pixels narrower, and every offset was left
      // half a padding out of step. A sliver of a tile at each end, at every
      // scroll position, for any `itemWidth`. The two numbers have to be the
      // same box.
      const next = Math.max(0, e.nativeEvent.layout.width - contentInset);
      measured.current = next;
      setWidth((prev) => (prev === next ? prev : next));
      // Mount enough to fill the row the moment it is measured.
      grow(Math.ceil(next / itemWidth) + OVERSCAN);
    },
    [grow, itemWidth, contentInset],
  );

  // A new pitch puts the row off its own grid, and nothing else will put it back:
  // `edgeScrollOffset` returns the offset unchanged while it is inside the margin
  // window, so an off-grid one survives every press. Snap it, clamped to the row.
  useEffect(() => {
    const furthest = maxOffset(count, pitch, measured.current);
    const snapped = Math.round(
      Math.min(furthest, Math.max(0, Math.round(at.current / pitch) * pitch)),
    );
    if (snapped === at.current) return;
    at.current = snapped;
    setOffset(snapped);
  }, [pitch, count]);

  const mounted = Math.min(count, reach + 1);
  /** Every tile's cell is the same box, so it is the same OBJECT: the tiles
   *  rebuild on every pan (`mounted` grows), and a fresh style per tile is a
   *  guaranteed styleq cache miss per tile on each of those. */
  const cell = useMemo(() => ({ width: pitch, paddingHorizontal: gap / 2 }), [pitch, gap]);
  const tiles = useMemo(() => {
    const out: ReactElement[] = [];
    for (let index = 0; index < mounted; index++) {
      const item = data[index];
      if (item === undefined) continue;
      out.push(
        // The tile's own <Focusable> reports through this. It is the only signal
        // that fires in BOTH directions: the navigator's `onActive` is monotone,
        // so a row wired to that scrolls right and freezes going left.
        // Every tile occupies exactly one PITCH, whatever it draws inside it.
        // The offset maths counts in pitches, so a tile that takes its own width
        // instead would drift a little further out of step on every step.
        <View key={index} style={cell}>
          <FocusReporter onFocus={() => selectRef.current(index)}>
            {renderItem(item, index)}
          </FocusReporter>
        </View>,
      );
    }
    return out;
  }, [data, mounted, cell, renderItem]);

  const furthest = maxOffset(count, pitch, measured.current);
  const arrowsOn = WEB && arrows;
  /** Which ends have something beyond them, and so are faded away. */
  const fadeStart = offset > 1;
  const fadeEnd = offset < furthest - 1;
  /** A wheel gesture calls `setOffset` on every tick, and the mask is a dozen
   *  rounded template literals joined into a string wrapped in a fresh style
   *  object - so unmemoised it was rebuilt, and the clip box's CSS rewritten, on
   *  every frame of a pan. It depends on the row's width and two booleans. */
  const clip = useMemo(
    () => [clipStyles.clip, WEB ? maskImage(railMask(edge, fadeStart, fadeEnd)) : null],
    [edge, fadeStart, fadeEnd],
  );

  return (
    <View
      ref={viewport}
      style={style}
      onLayout={onLayout}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Three ways the row moves, one per input the platform actually has. On
          touch it is a real ScrollView - thumb physics cannot be imitated with a
          transition, and before this branch existed a swipe on a phone moved
          nothing at all. Elsewhere the row is translated: by the D-pad through
          the navigator on a television, by the wheel and the arrows on the web.
          The fade is a MASK on the clip box on the web, and painted over the row
          on native, which has no mask - see `railMask` and `scrim`. */}
      {TOUCH ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={onTouchScroll}
          scrollEventThrottle={32}
          // The full row's width from the first frame, tiles or no tiles: the
          // scroll RANGE must not grow with the mounted window, or a hard fling
          // bounces off the end of what happened to be mounted.
          contentContainerStyle={[styles.row, contentStyle, { minWidth: count * pitch }]}
        >
          <SpatialNavigationView direction="horizontal">{tiles}</SpatialNavigationView>
        </ScrollView>
      ) : (
        <View style={clip}>
          <MovingRow offset={offset} instant={panning} style={contentStyle} interactive={!panning}>
            <SpatialNavigationView direction="horizontal">{tiles}</SpatialNavigationView>
          </MovingRow>
        </View>
      )}
      {/* The edges are always mounted, so their control FADES rather than
          appears: a row that can be scrolled says so at all times, and the
          button arrives when the pointer does. */}
      <RailEdge
        side="start"
        shown={fadeStart}
        arrow={arrowsOn && hovered}
        onPress={() => page(-1)}
        width={edge}
      />
      <RailEdge
        side="end"
        shown={fadeEnd}
        arrow={arrowsOn && hovered}
        onPress={() => page(1)}
        width={edge}
      />
    </View>
  );
}

/**
 * One end of the row: the pointer's page control, and on native the fade behind
 * it (the web fades with a mask instead - `railMask`).
 *
 * The BUTTON is the kit's glass treatment at the size a pointer wants, centred on
 * the row rather than filling its height, because a full-height slab covers
 * artwork the viewer is trying to look at.
 *
 * It is a plain `Pressable`, deliberately: every other control in the kit is a
 * `<Focusable>` and therefore a node of the navigator, which is exactly what
 * this must not be. A remote pages the row by walking it; an arrow in that path
 * would be a stop the D-pad has to cross to reach the next tile.
 *
 * It fades rather than appears, and stays mounted while it can be used, so the
 * pointer never chases a control that pops into existence under it.
 */
function RailEdge({
  side,
  shown,
  arrow,
  onPress,
  width,
}: Readonly<{
  side: 'start' | 'end';
  shown: boolean;
  arrow: boolean;
  onPress: () => void;
  /** How long the FADE is, sized from the row - see `edgeWidth`. The strip is
   *  that plus the focus bleed, which is where the tiles are cut off. */
  width: number;
}>) {
  const start = side === 'start';
  // The strip's own appearance ANIMATES on native too. `FADE` is a CSS
  // transition, which only react-native-web understands - on a phone or a
  // television the style is silently ignored and the painted gradient BLINKED
  // in the frame the row started moving. Same value, same duration, through
  // `Animated` where CSS is not available.
  const fade = useRef(new Animated.Value(shown ? 1 : 0)).current;
  useEffect(() => {
    if (WEB) return;
    Animated.timing(fade, {
      toValue: shown ? 1 : 0,
      duration: SETTLE_MS,
      easing: EASE_NATIVE,
      useNativeDriver: true,
    }).start();
  }, [shown, fade]);
  return (
    <Animated.View
      pointerEvents={shown && arrow ? 'box-none' : 'none'}
      style={[
        styles.edge,
        { width: width + FOCUS_BLEED },
        start ? styles.edgeStart : styles.edgeEnd,
        // Nothing is painted here on the web: the mask has already taken the
        // row's own edge away, and a gradient on top of that would be the slab
        // over the neighbouring content that the mask exists to stop being.
        WEB ? null : scrimStyle(start, width),
        WEB ? ({ opacity: shown ? 1 : 0 } as ViewStyle) : { opacity: fade },
        WEB ? (FADE as ViewStyle) : null,
      ]}
    >
      <Pressable
        focusable={false}
        accessibilityRole="button"
        accessibilityLabel={start ? 'Scroll left' : 'Scroll right'}
        onPress={onPress}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.arrow,
          { opacity: arrow ? 1 : 0 } as ViewStyle,
          FADE as ViewStyle,
          hovered ? styles.arrowHover : null,
          pressed ? styles.arrowPressed : null,
        ]}
      >
        <Icon name={start ? 'chevron-left' : 'chevron-right'} size={24} color="text" />
      </Pressable>
    </Animated.View>
  );
}

/**
 * The strip that moves, and the one place the two renderers differ.
 *
 * Web: a CSS transition on `transform`, so the browser animates it off the main
 * thread. Native: `Animated` with the real native driver. Same curve, same
 * duration, and in both cases exactly one style write per step.
 */
function MovingRow({
  offset,
  instant,
  interactive,
  style,
  children,
}: Readonly<{
  offset: number;
  instant: boolean;
  interactive: boolean;
  style?: ViewStyle;
  children: ReactElement;
}>) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (WEB) return;
    if (instant) {
      slide.setValue(-offset);
      return;
    }
    Animated.timing(slide, {
      toValue: -offset,
      duration: SETTLE_MS,
      easing: EASE_NATIVE,
      useNativeDriver: true,
    }).start();
  }, [instant, offset, slide]);

  const pointerEvents = interactive ? 'auto' : 'none';

  if (WEB) {
    return (
      <View
        pointerEvents={pointerEvents}
        style={[
          styles.row,
          style,
          {
            transform: [{ translateX: -offset }],
            // Typed loosely because these are CSS-only style props that
            // react-native-web understands and React Native's types do not.
            transitionProperty: 'transform',
            transitionDuration: `${instant ? 0 : SETTLE_MS}ms`,
            transitionTimingFunction: EASE_CSS,
          } as ViewStyle,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={[styles.row, style, { transform: [{ translateX: slide }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  /** The strip at one end of the row, holding the control - and on native the
   *  painted fade as well. Outside the clip box, so the button is never cut by
   *  it, and reaching as far out sideways as the clip does, so the native scrim
   *  covers the tile the clip cuts off in its own bleed instead of stopping just
   *  short of it. See `scrim`.
   *
   *  The ROW's height, not the clip's: what a taller strip would cover is not
   *  the row, it is whatever sits above and below it - and 32px above a rail is
   *  its title, which the scrim duly washed out. The web has no such compromise
   *  to make, because a mask can only take away the row's own pixels. */
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 2,
  },
  // The control sits AT the end of the row, not centred in the strip: the strip
  // is as wide as the fade needs to be, and a button floating half a strip in
  // reads as sitting on the tile it happens to be over rather than as the row's
  // own edge control. A hair of padding keeps it off the very pixel.
  // At the row's own edge, which is also where the tiles end: the pitch fits a
  // whole number of them, so nothing is painted out in the focus bleed for the
  // control to sit inside of.
  // Pulled out by the bleed, and padded back in by it, so the strip covers the
  // clip's edge while the control stays at the ROW's edge where the tiles end.
  edgeStart: {
    left: -FOCUS_BLEED,
    alignItems: 'flex-start',
    paddingLeft: FOCUS_BLEED + EDGE_INSET,
  },
  edgeEnd: {
    right: -FOCUS_BLEED,
    alignItems: 'flex-end',
    paddingRight: FOCUS_BLEED + EDGE_INSET,
  },
  /** The kit's glass control: a translucent fill over a hairline, which reads on
   *  artwork of any brightness. */
  arrow: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    boxShadow: shadow.card,
  },
  arrowHover: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  arrowPressed: { backgroundColor: 'rgba(255, 255, 255, 0.28)', transform: [{ scale: 0.94 }] },
});

export type { VirtualRailProps };
export { edgeWidth, horizontalInset, railMask, VirtualRail };
