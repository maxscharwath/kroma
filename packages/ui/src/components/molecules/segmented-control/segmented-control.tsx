// <SegmentedControl>: one selected option among a few. A radiogroup to
// assistive tech: each segment is a radio carrying `checked`, and on a physical
// keyboard the arrow keys move the selection the way a native radio group does.
//
// Composed, in Radix's shape: a Root that owns the value, the semantics and the
// keyboard, and Items that read it through context. A segment is not a fixed
// arrangement of label + hint, and a props-only API answers every new demand
// with another prop until the component is a switchboard. `options` stays as
// sugar so the common row is still one line.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Focusable } from '#ui/components/atoms/focusable';
import { Icon, type IconName } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { type StyleDecl, svFor, useTheme } from '#ui/core';
import { nestedRadius } from '#ui/core/tokens';
import {
  bySize,
  CONTROL,
  type ControlSize,
  controlRadius,
  entryDefaultSize,
} from '#ui/lib/field-shell';
import { FocusRegion } from '#ui/lib/focus-scope';

// The group's own padding, and therefore how much smaller a segment's corner
// is than the group's: concentric corners, not two radii guessed apart.
const GROUP_PAD = 4;

// A segment is a control in the same family as an entry: the shell's own
// padding and type, with the corner stepped in so the pill's inner radius
// nests inside the group's (see lib/field-shell).
const segmentedControlVariants = svFor<{ root: StyleDecl; label: StyleDecl; desc: StyleDecl }>()({
  slots: {
    root: { row: true, center: true, gap: 7, _hover: { bg: 'tint/8' }, _press: { bg: 'tint/14' } },
    label: { font: 'ui', fontWeight: '600', color: 'text/75' },
    desc: { font: 'ui', fontSize: 11, color: 'textDim' },
  },
  variants: {
    size: bySize((m) => ({
      root: { px: m.px, py: m.py - GROUP_PAD, minH: m.line },
      label: { fontSize: m.fontSize, lineHeight: m.line },
    })),
    // No fill of its own: the thumb behind the row carries the selection, so it
    // can travel between segments rather than blink from one to the next.
    active: {
      true: {
        root: { _hover: { bg: 'transparent' }, _press: { bg: 'transparent' } },
        label: { color: 'accentText' },
      },
    },
  },
  defaults: { size: 'md', active: false },
});

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Leading glyph. Under `iconOnly` it is the whole segment, and `label`
   *  becomes the accessible name. */
  icon?: IconName;
  /** A quieter second line under the label ("Recommandé", a codec note). */
  desc?: string;
  disabled?: boolean;
}

interface Box2D {
  x: number;
  width: number;
}

interface SegmentedContext {
  value: string;
  select: (next: string) => void;
  size: ControlSize;
  stretch: boolean;
  iconOnly: boolean;
  report: (value: string, box: Box2D) => void;
  register: (value: string) => void;
  mark: (value: string, disabled: boolean) => void;
  forget: (value: string) => void;
}

const Context = createContext<SegmentedContext | null>(null);

function useSegmented(part: string): SegmentedContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error(`<SegmentedControl.${part}> must be used inside its Root`);
  return ctx;
}

interface RootProps<T extends string> {
  value: T;
  onValueChange: (next: T) => void;
  /** Accessible name of the group: what the segments are segments OF. */
  label?: string;
  /** The control shell's size; see <TextField>. */
  size?: ControlSize;
  /** Fill the width, every segment an equal share, instead of hugging its
   *  labels. For a control that names the MODE of the screen under it rather
   *  than a value in a form: a pill floating mid-page reads as unanchored, and
   *  a full-width bar reads as the thing the page is currently showing. */
  stretch?: boolean;
  /** Draw each segment as its glyph alone. For options that are universally
   *  understood as icons and whose words would be noise. */
  iconOnly?: boolean;
  /** Sugar for the plain case, instead of writing an Item per option. */
  options?: readonly SegmentedOption<T>[];
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function Root<T extends string>({
  value,
  onValueChange,
  label,
  size,
  stretch = false,
  iconOnly = false,
  options,
  children,
  style,
}: Readonly<RootProps<T>>) {
  const shell = size ?? entryDefaultSize();
  const metrics = CONTROL[shell];
  // The row as the keyboard walks it: the order Items registered in, which for
  // a flex row is the order they are read in. Deliberately NOT the measured
  // geometry — that arrives a frame later, and arrow keys must work on the
  // first render rather than only once something has been laid out.
  const order = useRef<string[]>([]);
  const off = useRef(new Set<string>());
  // Geometry, for the thumb alone.
  const boxes = useRef(new Map<string, Box2D>());
  const [thumb, setThumb] = useState<Box2D | null>(null);

  const report = useCallback(
    (option: string, box: Box2D) => {
      boxes.current.set(option, box);
      if (option === value) setThumb(box);
    },
    [value],
  );

  const register = useCallback((option: string) => {
    if (!order.current.includes(option)) order.current.push(option);
  }, []);

  const mark = useCallback((option: string, disabled: boolean) => {
    if (disabled) off.current.add(option);
    else off.current.delete(option);
  }, []);

  // An Item that leaves takes its seat with it, or the arrows keep walking onto
  // an option the caller has since removed.
  const forget = useCallback((option: string) => {
    const at = order.current.indexOf(option);
    if (at !== -1) order.current.splice(at, 1);
    off.current.delete(option);
    boxes.current.delete(option);
  }, []);

  useEffect(() => {
    const at = boxes.current.get(value);
    if (at) setThumb(at);
  }, [value]);

  // A disabled segment is stepped over rather than landed on: it is in the row
  // but it is not a choice.
  const move = (delta: -1 | 1) => {
    const row = order.current;
    const at = row.indexOf(value);
    if (at === -1) return;
    for (let step = 1; step <= row.length; step += 1) {
      const key = row[(((at + delta * step) % row.length) + row.length) % row.length];
      if (key === undefined || key === value) return;
      if (off.current.has(key)) continue;
      onValueChange(key as T);
      return;
    }
  };

  const ctx: SegmentedContext = {
    value,
    select: (next) => onValueChange(next as T),
    size: shell,
    stretch,
    iconOnly,
    report,
    register,
    mark,
    forget,
  };

  return (
    <Context.Provider value={ctx}>
      <FocusRegion>
        <Box
          row
          self={stretch ? 'stretch' : 'flex-start'}
          gap={GROUP_PAD}
          p={GROUP_PAD}
          radius={metrics.radius}
          border="borderStrong"
          bg="surface2"
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          // A physical keyboard moves the selection with the arrows, the way a
          // native radio group does; the D-pad already walks the FocusRegion.
          onKeyDown={(event) => {
            const key = event.nativeEvent.key;
            if (key === 'ArrowLeft' || key === 'ArrowUp') move(-1);
            else if (key === 'ArrowRight' || key === 'ArrowDown') move(1);
          }}
          style={style}
        >
          <Thumb at={thumb} radius={segmentRadius(shell)} />
          {options?.map((option) => (
            <Item key={option.value} {...option} />
          ))}
          {children}
        </Box>
      </FocusRegion>
    </Context.Provider>
  );
}

function Item<T extends string>({
  value,
  label,
  icon,
  desc,
  disabled,
}: Readonly<SegmentedOption<T>>) {
  const ctx = useSegmented('Item');
  const { value: picked, select, size, stretch, iconOnly, report, register, mark, forget } = ctx;
  const active = value === picked;
  const glyph = Math.round(CONTROL[size].fontSize * 1.2);
  const corner = { borderRadius: segmentRadius(size) };
  // Two effects, not one: re-running the registration when `disabled` toggles
  // would drop the segment and push it back on at the end of the row.
  useEffect(() => {
    register(value);
    return () => forget(value);
  }, [register, forget, value]);
  useEffect(() => {
    mark(value, Boolean(disabled));
  }, [mark, value, disabled]);
  // The wrapper is what the thumb measures: <Focusable> owns its own layout
  // callback for the press dip, and a second one cannot ride the same channel.
  return (
    <Box
      onLayout={(event: LayoutChangeEvent) => report(value, event.nativeEvent.layout)}
      style={stretch ? SEGMENT_GROW : undefined}
    >
      <Focusable
        role="radio"
        checked={active}
        label={label}
        disabled={disabled}
        onPress={() => select(value)}
        sv={segmentedControlVariants}
        vars={{ size, active }}
        style={stretch ? [SEGMENT_FILL, corner] : corner}
      >
        {(state) => (
          <>
            {icon ? (
              <Icon name={icon} size={glyph} color={active ? 'accentText' : 'text/75'} />
            ) : null}
            {iconOnly && icon ? null : <Txt style={state.slots.label}>{label}</Txt>}
            {desc ? <Txt style={state.slots.desc}>{desc}</Txt> : null}
          </>
        )}
      </Focusable>
    </Box>
  );
}

// The selection travels rather than blinking, so the eye follows it across the
// row. One layer behind every segment, which is why a segment paints no fill.
function Thumb({ at, radius }: Readonly<{ at: Box2D | null; radius: number }>) {
  const theme = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!at) return;
    if (!placed.current) {
      placed.current = true;
      x.setValue(at.x);
      width.setValue(at.width);
      return;
    }
    const settle = { duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false };
    Animated.parallel([
      Animated.timing(x, { toValue: at.x, ...settle }),
      Animated.timing(width, { toValue: at.width, ...settle }),
    ]).start();
  }, [at, x, width]);
  if (!at) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        THUMB,
        {
          backgroundColor: theme.colors.accentSoft,
          borderRadius: radius,
          transform: [{ translateX: x }],
          width,
        },
      ]}
    />
  );
}

// A segment's corner is the group's minus the padding between them: concentric,
// so the pair still nests once a theme restates the corner language.
function segmentRadius(size: ControlSize): number {
  return nestedRadius(controlRadius(CONTROL[size]), GROUP_PAD);
}

const THUMB = { position: 'absolute', top: GROUP_PAD, bottom: GROUP_PAD, left: 0 } as const;

// An equal share of the row, with the label centred in it. Frozen rather than
// built per render: it never varies.
const SEGMENT_GROW = { flex: 1, alignItems: 'center' } as const;

const SEGMENT_FILL = { alignSelf: 'stretch', alignItems: 'center' } as const;

const SegmentedControl = { Root, Item };

export type { RootProps as SegmentedRootProps, SegmentedOption };
export { SegmentedControl, segmentedControlVariants };
