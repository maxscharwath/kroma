// <NavPill>: the floating section switcher, as ONE component.
//
// A capsule of icon + label items where the current section sits in its own
// amber lens. The Apple TV's top nav and the iPhone's bottom tab bar are this
// same design at two distances - and until this file they were two
// implementations (packages/tv NavPill, clients/mobile PillTabBar) drifting a
// padding at a time. The kit owns the capsule; the apps own what pressing an
// item MEANS.
//
// The API is compound, shadcn-fashion: the root carries the shared decisions
// (metrics, label policy, the fill) down by context, and each item is its own
// child rather than a row in a config array - so a host can wrap one item in a
// badge, ref the last one for focus wiring, or put something that is not an
// item in the row, none of which an `items` prop can say.
//
//   <NavPill size="tv">
//     <NavPillItem icon="home" label="Home" active onPress={goHome} />
//     <NavPillItem icon="search" label="Search" onPress={goSearch} />
//   </NavPill>
//
// The two sizes are the two distances. `tv` keeps every label - a viewer three
// metres away is reading, not tapping, and constant labels mean the capsule
// never changes width under the travelling ring. `sm` (a thumb on glass) shows
// the label only on the active item, which is how the bar fits a phone.
//
// The LENS TRAVELS. The amber is one view owned by the root, not a background
// each item paints: items report where they sit, and when the section changes
// the lens springs from the old item's box to the new one's - the morph a
// segmented control taught everyone to expect, and the reason the root has to
// know the geometry at all. On the kit's usual split: a CSS transition where
// react-native-web would otherwise run a rAF loop, `Animated` elsewhere (the
// JS driver, deliberately - left and width are layout properties the native
// driver cannot carry, and a 260ms one-shot is what the JS driver is for).
//
// The fill is a solid translucency, not a blur: Tizen composites blur on the
// CPU and pays in frames on every focus move. A platform that composites it on
// the GPU (the iPhone) passes its own <BlurView> as `backdrop`, and the fill
// thins to let it read - the kit stays free of platform blur dependencies.

import {
  createContext,
  type ComponentRef,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  Platform,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Focusable, type FocusableProps } from '#ui/components/atoms/focusable';
import { Icon, type IconName } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { colors, motion } from '#ui/lib/tokens';

const WEB = Platform.OS === 'web';

/** How the lens travels: the kit's spring curve, at a pace that reads as the
 * lens ARRIVING somewhere rather than teleporting or wallowing. */
const TRAVEL_MS = 260;
const [x1, y1, x2, y2] = motion.bezier.spring;
const EASE_CSS = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
const EASE_NATIVE = Easing.bezier(x1, y1, x2, y2);

type NavPillSize = 'sm' | 'tv';

/** Where an item sits inside the capsule, in the capsule's own coordinates. */
interface LensRect {
  x: number;
  width: number;
}

interface PillContext {
  size: NavPillSize;
  /** The active item saying where it is. `id` is the caller's own, so a report
   *  from an item that has since gone inactive cannot clobber the owner's. */
  claim: (id: string, rect: LensRect) => void;
  /** An item that WAS the lens's owner saying it no longer is. */
  release: (id: string) => void;
}

interface NavPillProps {
  /** `tv`: 10-foot metrics, every label. `sm`: thumb metrics, active label only. */
  size?: NavPillSize;
  /** A platform's own backdrop (the iPhone's BlurView), filled behind the
   *  items. Given one, the capsule's own fill thins so it can read. */
  backdrop?: ReactNode;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

const Context = createContext<PillContext>({ size: 'tv', claim: () => {}, release: () => {} });

function NavPill({ size = 'tv', backdrop, style, children }: Readonly<NavPillProps>) {
  const [lens, setLens] = useState<{ id: string; rect: LensRect } | null>(null);
  const claim = useCallback((id: string, rect: LensRect) => {
    setLens((prev) =>
      prev?.id === id && prev.rect.x === rect.x && prev.rect.width === rect.width
        ? prev
        : { id, rect },
    );
  }, []);
  const release = useCallback((id: string) => {
    setLens((prev) => (prev?.id === id ? null : prev));
  }, []);
  return (
    <Context.Provider value={{ size, claim, release }}>
      <Box
        row
        align="center"
        gap={4}
        p={6}
        radius="pill"
        border="borderStrong"
        bg={backdrop ? BACKDROP_FILL : PILL_FILL}
        overflow="hidden"
        style={style}
      >
        {backdrop ? (
          <Box absolute top={0} right={0} bottom={0} left={0}>
            {backdrop}
          </Box>
        ) : null}
        <Lens rect={lens?.rect ?? null} />
        {children}
      </Box>
    </Context.Provider>
  );
}

/**
 * The travelling amber. One view for the whole capsule, sprung between the
 * boxes the items report. It SNAPS into its first place - a lens animating in
 * from nowhere on mount would be an entrance nobody staged - and fades away
 * when no item is active (a deep screen), keeping its last box so it can fade
 * back in place if the same section returns.
 */
function Lens({ rect }: Readonly<{ rect: LensRect | null }>) {
  // Vertical inset matches the capsule's own padding, so the lens is exactly
  // the box the item used to paint for itself.
  if (WEB) return <WebLens rect={rect} />;
  return <NativeLens rect={rect} />;
}

function WebLens({ rect }: Readonly<{ rect: LensRect | null }>) {
  // The first box is taken without a transition: the style below only carries
  // `transitionProperty` once a box has already been committed.
  const placed = useRef(false);
  const had = placed.current;
  if (rect) placed.current = true;
  const last = useRef<LensRect | null>(null);
  if (rect) last.current = rect;
  const box = rect ?? last.current;
  if (!box) return null;
  return (
    <Box
      absolute
      top={6}
      bottom={6}
      radius="pill"
      bg={colors.accentSoft}
      style={
        {
          left: box.x,
          width: box.width,
          opacity: rect ? 1 : 0,
          transitionProperty: had ? 'left, width, opacity' : 'opacity',
          transitionDuration: `${TRAVEL_MS}ms`,
          transitionTimingFunction: EASE_CSS,
        } as ViewStyle
      }
    />
  );
}

function NativeLens({ rect }: Readonly<{ rect: LensRect | null }>) {
  const left = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const shown = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const last = useRef<LensRect | null>(null);
  if (rect) last.current = rect;

  useEffect(() => {
    if (rect && !placed.current) {
      // First placement: arrive, do not travel.
      placed.current = true;
      left.setValue(rect.x);
      width.setValue(rect.width);
      shown.setValue(1);
      return;
    }
    const eased = { duration: TRAVEL_MS, easing: EASE_NATIVE, useNativeDriver: false } as const;
    if (rect) {
      Animated.parallel([
        Animated.timing(left, { toValue: rect.x, ...eased }),
        Animated.timing(width, { toValue: rect.width, ...eased }),
        Animated.timing(shown, { toValue: 1, ...eased }),
      ]).start();
      return;
    }
    Animated.timing(shown, { toValue: 0, ...eased }).start();
  }, [rect, left, width, shown]);

  if (!last.current && !rect) return null;
  return <Animated.View style={[styles.lens, { left, width, opacity: shown }]} />;
}

/** An item's picture: a kit glyph by name, or - for a host whose icons are its
 * own components (the iPhone's tab icons) - a function handed the item's
 * current ink, so its colour still travels with focus. */
type NavPillIcon = IconName | ((ink: string) => ReactNode);

interface NavPillItemProps
  extends Omit<FocusableProps, 'children' | 'onPress' | 'label' | 'style'> {
  icon: NavPillIcon;
  label: string;
  /** The current section. At most one item should say so. */
  active?: boolean;
  onPress: () => void;
  /** For a host's focus wiring: the TV names the last item as the avatar's
   *  left-hand neighbour. */
  ref?: Ref<ComponentRef<typeof View>>;
}

function NavPillItem({
  icon,
  label,
  active = false,
  onPress,
  ref,
  ...focus
}: Readonly<NavPillItemProps>) {
  const { size, claim, release } = useContext(Context);
  const metrics = METRICS[size];
  const id = useId();
  /** Where this item sits, kept current by layout; CLAIMED only while active. */
  const rect = useRef<LensRect | null>(null);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      rect.current = { x, width };
      if (active) claim(id, rect.current);
    },
    [active, claim, id],
  );
  useEffect(() => {
    if (active && rect.current) claim(id, rect.current);
    if (!active) release(id);
  }, [active, claim, release, id]);

  return (
    <Box onLayout={onLayout}>
      <Focusable
        {...focus}
        ref={ref}
        onPress={onPress}
        label={label}
        focusScale={1.04}
        style={metrics.item}
        focusedStyle={active ? null : FOCUSED}
      >
        {({ focused }) => {
          const ink = inkOf(active, focused);
          return (
            <>
              {typeof icon === 'string' ? (
                <Icon name={icon} size={metrics.icon} stroke={1.9} color={ink} />
              ) : (
                icon(ink)
              )}
              {/* `tv` keeps every label so the capsule holds its width under the
                  travelling lens; `sm` gives the row to the icons and spends the
                  width on the one label that orients. */}
              {size === 'tv' || active ? (
                <Txt style={metrics.label} color={ink}>
                  {label}
                </Txt>
              ) : null}
            </>
          );
        }}
      </Focusable>
    </Box>
  );
}

/** The current section is amber; an idle one recedes, and comes up to full ink
 * under the ring. Icon and label always take the same ink, so an item reads as
 * one object rather than a glyph next to a word. */
function inkOf(active: boolean, focused: boolean): string {
  if (active) return colors.accentBright;
  return focused ? colors.text : colors.textMuted;
}

const PILL_FILL = 'rgba(18, 18, 22, 0.78)';
/** Over a host backdrop the fill only has to tint, not to be the surface. */
const BACKDROP_FILL = 'rgba(18, 18, 22, 0.55)';

/** One geometry per size for every state: the box is the same whether the item
 * is idle, focused or current, so only colour and the lens move. */
const METRICS = {
  tv: {
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 999,
    },
    icon: 26,
    label: { fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
  },
  sm: {
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
    },
    icon: 22,
    label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  },
} as const;

const FOCUSED = { backgroundColor: 'rgba(255, 255, 255, 0.10)' };

const styles = {
  lens: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
} as const;

export type { NavPillIcon, NavPillItemProps, NavPillProps, NavPillSize };
export { NavPill, NavPillItem };
