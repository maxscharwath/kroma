// <Switch>: the on/off primitive.
//
// A television has no gestures, so this is not a draggable thumb: it is a
// Focusable that toggles on Select, and the thumb snaps. The state has to be
// legible from three metres, which is why the track fills amber rather than
// relying on the thumb's position alone.

import { sv } from '../../lib/sv';
import { colors, radius } from '../../lib/tokens';
import { Box } from './box';
import { Focusable, type FocusableProps } from './focusable';

const switchVariants = sv({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  variants: {
    size: {
      sm: { width: 46, height: 28, padding: 3 },
      /** The 10-foot size, for a settings row read from the sofa. */
      tv: { width: 64, height: 36, padding: 4 },
    },
    checked: {
      true: { backgroundColor: colors.accent, borderColor: colors.accent },
      false: { backgroundColor: 'rgba(255, 255, 255, 0.10)', borderColor: colors.borderStrong },
    },
  },
  defaults: { size: 'sm', checked: 'false' },
});

/** Thumb diameter per size, derived from the track so the two cannot drift. */
const THUMB = { sm: 20, tv: 26 } as const;

type SwitchSize = keyof typeof THUMB;

interface SwitchProps extends Omit<FocusableProps, 'children' | 'onPress' | 'style'> {
  checked: boolean;
  onChange?: (next: boolean) => void;
  size?: SwitchSize;
  style?: FocusableProps['style'];
}

function Switch({
  checked,
  onChange,
  size = 'sm',
  disabled = false,
  style,
  ...focusProps
}: Readonly<SwitchProps>) {
  return (
    <Focusable
      {...focusProps}
      disabled={disabled}
      onPress={onChange ? () => onChange(!checked) : undefined}
      style={switchVariants(
        { size, checked: checked ? 'true' : 'false' },
        // The thumb is pushed by the track's own justification rather than
        // positioned absolutely, so one flex rule covers both states.
        { justifyContent: checked ? 'flex-end' : 'flex-start' },
        disabled ? DISABLED : null,
        style,
      )}
    >
      <Box w={THUMB[size]} h={THUMB[size]} radius="pill" bg={checked ? 'accentInk' : 'text'} />
    </Focusable>
  );
}

const DISABLED = { opacity: 0.5 } as const;

export type { SwitchProps, SwitchSize };
export { Switch, switchVariants };
