// <IconButton>: a round, icon-only control (the theme-song mute, a close button,
// a player transport key). Same focus behaviour as <Button>, no label.

import { Focusable, type FocusableProps } from '../focus/Focusable';
import { sv } from '../system/sv';
import { colors, radius } from '../tokens';
import { Icon, type IconName } from './Icon';

const iconButton = sv({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  variants: {
    variant: {
      /** Translucent fill with a hairline border: the default over artwork. */
      glass: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
      ghost: { backgroundColor: 'transparent' },
      primary: { backgroundColor: colors.accent },
    },
  },
  defaults: { variant: 'glass' },
});

export interface IconButtonProps extends Omit<FocusableProps, 'children' | 'focusScale'> {
  icon: IconName;
  /** Diameter. The design uses 60 on the detail screen. */
  size?: number;
  /** Glyph size. Defaults to 40% of the diameter. */
  glyph?: number;
  variant?: 'glass' | 'ghost' | 'primary';
  focusScale?: number;
}

export function IconButton({
  icon,
  size = 60,
  glyph,
  variant = 'glass',
  style,
  focusScale = 1.04,
  ...focusProps
}: Readonly<IconButtonProps>) {
  return (
    <Focusable
      {...focusProps}
      focusScale={focusScale}
      style={iconButton({ variant }, { width: size, height: size }, style)}
    >
      <Icon
        name={icon}
        size={glyph ?? Math.round(size * 0.4)}
        color={variant === 'primary' ? 'accentInk' : 'text'}
      />
    </Focusable>
  );
}
