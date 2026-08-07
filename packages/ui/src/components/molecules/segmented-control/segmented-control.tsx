// <SegmentedControl>: one selected option among a few, each with an optional
// sub-label. A radiogroup to assistive tech: each segment is a radio carrying
// `checked`, and on a physical keyboard the arrow keys move the selection the
// way a native radio group does.

import type { StyleProp, ViewStyle } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Focusable } from '#ui/components/atoms/focusable';
import { Txt } from '#ui/components/atoms/text';
import { type StyleDecl, svFor } from '#ui/core';
import { FocusRegion } from '#ui/lib/focus-scope';

const segmentedControlVariants = svFor<{ root: StyleDecl; label: StyleDecl; desc: StyleDecl }>()({
  slots: {
    root: { radius: 8, px: 14, py: 8, _hover: { bg: 'white/5' } },
    label: { font: 'ui', fontSize: 13, fontWeight: '600', color: 'text/75' },
    desc: { font: 'ui', fontSize: 11, color: 'textDim' },
  },
  variants: {
    active: {
      true: {
        root: { bg: 'accentSoft', _hover: { bg: 'accentSoft' } },
        label: { color: 'accent' },
      },
    },
  },
  defaults: { active: false },
});

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** A quieter second line under the label ("Recommandé", a codec note). */
  desc?: string;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (next: T) => void;
  /** Accessible name of the group. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** The next enabled option in `delta` direction, wrapping at the ends. */
function step<T extends string>(
  options: readonly SegmentedOption<T>[],
  value: T,
  delta: -1 | 1,
): T | null {
  const at = options.findIndex((option) => option.value === value);
  for (let hop = 1; hop <= options.length; hop++) {
    const next = options[(at + delta * hop + options.length * hop) % options.length];
    if (next && !next.disabled) return next.value === value ? null : next.value;
  }
  return null;
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  style,
}: Readonly<SegmentedControlProps<T>>) {
  const move = (delta: -1 | 1) => {
    const next = step(options, value, delta);
    // `!== null`, not truthiness: '' is a legal option value ("Auto").
    if (next !== null) onChange(next);
  };
  return (
    <FocusRegion>
      <Box
        row
        self="flex-start"
        gap={4}
        p={4}
        radius={11}
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
        {options.map((option) => (
          <Segment
            key={option.value}
            option={option}
            active={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </Box>
    </FocusRegion>
  );
}

function Segment<T extends string>({
  option,
  active,
  onPress,
}: Readonly<{ option: SegmentedOption<T>; active: boolean; onPress: () => void }>) {
  return (
    <Focusable
      role="radio"
      checked={active}
      label={option.label}
      disabled={option.disabled}
      onPress={onPress}
      sv={segmentedControlVariants}
      vars={{ active }}
    >
      {(state) => (
        <>
          <Txt style={state.slots.label}>{option.label}</Txt>
          {option.desc ? <Txt style={state.slots.desc}>{option.desc}</Txt> : null}
        </>
      )}
    </Focusable>
  );
}

export type { SegmentedControlProps, SegmentedOption };
export { SegmentedControl, segmentedControlVariants };
