// <ListRow>: one focusable row of a menu or a settings list.
//
// This shape was written three times before it moved here: the TV profile menu,
// the signed-out device settings, and the admin lists. It is a molecule rather
// than a primitive because it composes four of them (Focusable, Icon, Txt and
// whatever sits at the end) into the one arrangement the design specifies:
// a round glyph well, the label taking the slack, and a trailing affordance.

import type { ReactNode } from 'react';
import { Box } from '#ui/components/atoms/box';
import { Focusable, type FocusableProps } from '#ui/components/atoms/focusable';
import { Icon, type IconName } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { sv } from '#ui/lib/sv';
import { colors, radius } from '#ui/lib/tokens';

const listRowVariants = sv({
  slots: {
    root: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    label: { fontWeight: '700' },
    hint: {},
  },
  variants: {
    size: {
      sm: {
        root: { gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
        label: { fontSize: 15 },
        hint: { fontSize: 13 },
      },
      /** The 10-foot row: bigger target, bigger type, more air. */
      tv: {
        root: { gap: 16, paddingHorizontal: 20, paddingVertical: 16 },
        label: { fontSize: 18 },
        hint: { fontSize: 15 },
      },
    },
  },
  defaults: { size: 'tv' },
});

/** Non-style metrics per size: the glyph well and the glyph inside it. */
const METRICS = {
  sm: { well: 34, glyph: 17 },
  tv: { well: 42, glyph: 20 },
} as const;

type ListRowSize = keyof typeof METRICS;

interface ListRowProps extends Omit<FocusableProps, 'children' | 'style' | 'label'> {
  /** Leading glyph. Omit it and the row starts at the label. */
  icon?: IconName;
  label: string;
  /** A second line under the label, for the rows that need explaining. */
  hint?: string;
  size?: ListRowSize;
  /** Trailing content: a value, a Switch, a Badge. Defaults to a chevron when
   *  the row leads somewhere, and to nothing when it does not. */
  trailing?: ReactNode;
  style?: FocusableProps['style'];
}

function ListRow({
  icon,
  label,
  hint,
  size = 'tv',
  trailing,
  onPress,
  style,
  ...focusProps
}: Readonly<ListRowProps>) {
  const metrics = METRICS[size];
  const s = listRowVariants({ size });
  return (
    <Focusable
      {...focusProps}
      onPress={onPress}
      label={label}
      focusScale={1.02}
      ring={false}
      style={[s.root, style]}
      focusedStyle={FOCUSED}
    >
      {icon ? (
        <Box w={metrics.well} h={metrics.well} shrink={0} center radius="xl" bg={WELL}>
          <Icon name={icon} size={metrics.glyph} color="textMuted" />
        </Box>
      ) : null}
      <Box flex gap={2}>
        <Txt style={s.label}>{label}</Txt>
        {hint ? (
          <Txt color="textDim" style={s.hint}>
            {hint}
          </Txt>
        ) : null}
      </Box>
      {trailing ??
        (onPress ? <Icon name="chevron-right" size={metrics.glyph} color="textDim" /> : null)}
    </Focusable>
  );
}

const WELL = 'rgba(255, 255, 255, 0.06)';
/** Focus is a solid amber edge rather than a fill: a row is wide, and a filled
 * one at the top of a list reads as "selected forever" instead of "focused". */
const FOCUSED = { borderColor: colors.accent } as const;

export type { ListRowProps, ListRowSize };
export { ListRow, listRowVariants };
