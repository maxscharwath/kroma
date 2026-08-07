// <Keypad>: the remote's half of <PinField>. Nine digits, a zero and a
// delete, laid out as the phone dial everybody knows so the D-pad walks it
// without instructions.
//
// There is no OK key: the field completes itself on the last digit (see
// `onComplete`), so the space under the centre column is left empty rather
// than filled with one, which also keeps 0 under 2, 5 and 8 where a hand
// expects it.
//
// Each row is its own <FocusRegion> inside a grid <FocusColumn>, which keeps
// the column on a vertical press — without it the navigator lands on a row's
// own remembered key, so Down from 3 went to 4 and every vertical press read
// as a diagonal.

import { SpatialNavigationNode } from 'react-tv-space-navigation';
import { Box } from '#ui/components/atoms/box';
import { Focusable } from '#ui/components/atoms/focusable';
import { Icon } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { type StyleDecl, styles, svFor } from '#ui/core';
import { CONTROL } from '#ui/lib/field-shell';
import { FocusColumn, FocusRegion } from '#ui/lib/focus-scope';
import { useTDefault } from '#ui/services/i18n';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

type KeyKind = 'digit' | 'delete';

const keypadVariants = svFor<{ root: StyleDecl; label: StyleDecl }>()({
  slots: {
    root: {
      w: 88,
      h: 72,
      center: true,
      radius: '2xl',
      // The same well a field and a keyboard key sit in (lib/field-shell),
      // opaque: a keypad is a grid of controls, and over artwork a wash let
      // every key sample whatever was behind it.
      bg: CONTROL.md.bg,
      // A key under the cursor lifts its own wash rather than borrowing the
      // amber: on a PIN pad, amber says "this is where Enter goes".
      _hover: { bg: 'surface3' },
      _focus: { bg: 'accentSoft' },
    },
    label: { fontWeight: '700', color: 'text', _focus: { color: 'accent' } },
  },
  variants: {
    kind: {
      digit: { label: { fontSize: 28 } },
      delete: { label: { fontSize: 22 } },
    },
  },
  defaults: { kind: 'digit' },
});

interface KeypadProps {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  /** Takes the screen's focus on mount, landing on the 1 key. On by default:
   *  a PIN screen has nowhere else worth starting. */
  autoFocus?: boolean;
  /** Ignore presses (a code is being checked, a lockout is counting down). */
  disabled?: boolean;
}

function Keypad({ onDigit, onDelete, autoFocus = true, disabled }: Readonly<KeypadProps>) {
  const t = useTDefault();
  const key = (label: string, onPress: () => void, kind: KeyKind = 'digit') => (
    <Focusable
      key={label}
      onPress={onPress}
      // The delete key draws a glyph, so its accessible name is a WORD: the
      // backspace character reaches a screen reader as "erase to the left",
      // or as nothing at all.
      label={kind === 'delete' ? t('common.delete') : label}
      disabled={disabled}
      autoFocus={autoFocus && label === '1'}
      focusScale={1.08}
      ring={false}
      sv={keypadVariants}
      vars={{ kind }}
    >
      {(state) =>
        kind === 'delete' ? (
          <Icon name="backspace" size={30} stroke={1.8} color="textMuted" />
        ) : (
          <Txt style={state.slots.label}>{label}</Txt>
        )
      }
    </Focusable>
  );
  return (
    <FocusColumn grid style={s.pad}>
      {ROWS.map((row) => (
        <FocusRegion key={row.join('')} style={s.padRow}>
          {row.map((d) => key(d, () => onDigit(d)))}
        </FocusRegion>
      ))}
      <FocusRegion style={s.padRow}>
        {/* The spacer keeps 0 under the centre column with no OK key - in the
            LAYOUT through the box, and in the NAVIGATOR through the node, which
            occupies the row's first index without ever taking focus. */}
        <SpatialNavigationNode>
          <Box w={88} h={72} />
        </SpatialNavigationNode>
        {key('0', () => onDigit('0'))}
        {key('delete', onDelete, 'delete')}
      </FocusRegion>
    </FocusColumn>
  );
}

const s = styles({
  pad: { gap: 13 },
  padRow: { row: true, gap: 13 },
});

export type { KeypadProps };
export { Keypad };
