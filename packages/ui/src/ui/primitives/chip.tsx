// <Chip>: the pill filter / selector (language codes, audio formats, genres,
// recent searches). Focusable, so the same component is a click target in the
// browser and a D-pad stop on a TV.

import type { ReactNode } from 'react';
import { sv } from '../../lib/sv';
import { colors, fonts, radius } from '../../lib/tokens';
import { Focusable, type FocusableProps } from './focusable';
import { Icon, type IconName } from './icon';
import { Txt } from './text';

const chipVariants = sv({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variants: {
    active: {
      true: { backgroundColor: colors.accent },
      false: { backgroundColor: 'rgba(255, 255, 255, 0.07)' },
    },
    /** `subtle` is the strip that floats over the browse screens' ambient art:
     *  a fainter wash, no border, and muted text so it recedes until focused. */
    variant: {
      solid: {},
      subtle: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 0 },
      /** An opaque raised chip, for strips that sit on the page rather than over
       *  artwork (the season picker on a series detail screen). */
      surface: { backgroundColor: colors.surface2, borderWidth: 0 },
    },
    size: {
      sm: {},
      /** The 10-foot size: bigger tap area and type for a 3 m viewing distance. */
      tv: { paddingVertical: 10, paddingHorizontal: 22 },
    },
  },
  compound: [
    { when: { variant: 'subtle', active: 'true' }, style: { backgroundColor: colors.accent } },
  ],
  defaults: { active: 'false', size: 'sm', variant: 'solid' },
});

const LABEL = {
  sm: { fontFamily: fonts.ui, fontWeight: '600' as const, fontSize: 13 },
  tv: { fontFamily: fonts.ui, fontWeight: '600' as const, fontSize: 18 },
};

interface ChipProps extends Omit<FocusableProps, 'children' | 'style' | 'label'> {
  active?: boolean;
  size?: 'sm' | 'tv';
  variant?: 'solid' | 'subtle' | 'surface';
  /** Leading glyph, before the label. */
  icon?: IconName;
  label?: string;
  children?: ReactNode;
  style?: FocusableProps['style'];
}

function Chip({
  active = false,
  size = 'sm',
  variant = 'solid',
  icon,
  label,
  children,
  style,
  ...focusProps
}: Readonly<ChipProps>) {
  // `subtle` and `surface` both recede until focused, so their idle label is
  // muted; the default solid chip carries full-strength text.
  const idle = variant === 'solid' ? colors.text : colors.textMuted;
  return (
    <Focusable
      {...focusProps}
      label={label}
      style={chipVariants({ active: active ? 'true' : 'false', size, variant }, style)}
    >
      {icon ? (
        <Icon
          name={icon}
          size={size === 'tv' ? 17 : 15}
          stroke={2}
          color={active ? colors.accentInk : idle}
        />
      ) : null}
      {label === undefined ? null : (
        <Txt style={{ ...LABEL[size], color: active ? colors.accentInk : idle }}>{label}</Txt>
      )}
      {children}
    </Focusable>
  );
}

export type { ChipProps };
export { Chip, chipVariants };
