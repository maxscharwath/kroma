// The search keyboard: the layout's letters as-is, with space / backspace /
// close appended to the short tail row. Letters insert lowercase, since search
// is case-insensitive.

import type { ReactNode } from 'react';
import type { IconName } from '#ui/components/atoms/icon';
import { FocusColumn, FocusRegion } from '#ui/lib/focus-scope';
import { KEY, Key } from './key';
import { type KeyboardLayout, LAYOUT_LETTER_ROWS } from './keyboard-layouts';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

// One fixed box for every key of every layout: the digits row always has TEN
// keys, so a flex-sized key made a letter in a six-key row nearly twice as
// wide as the digit above it. Rows are centred, so the short tail row reads
// as a deliberate shape instead of a ragged edge.
const FACE = { height: KEY.height, width: KEY.width, flexShrink: 0 } as const;
const TEXT = { fontSize: 19 } as const;
const ROW_GAP = KEY.gap;
// The three trailing-row glyphs are optically balanced against each other, so
// they are sized together here rather than each at its own call site.
const GLYPH = { space: 24, back: 22, close: 20 } as const;

interface SearchKeyboardProps {
  value: string;
  onChange: (next: string) => void;
  onClose?: () => void;
  layout: KeyboardLayout;
}

function SearchKeyboard({ value, onChange, onClose, layout }: Readonly<SearchKeyboardProps>) {
  const letterRows = LAYOUT_LETTER_ROWS[layout];
  const lastRow = letterRows.at(-1) ?? [];
  const key = (id: string, label: string, onPress: () => void) => (
    <Key key={id} label={label} onPress={onPress} style={FACE} textStyle={TEXT} tone="search" />
  );
  const glyph = (id: string, name: IconName, size: number, onPress: () => void) => (
    <Key key={id} icon={name} iconSize={size} onPress={onPress} style={FACE} tone="search" />
  );
  const letter = (l: string) => key(l, l, () => onChange(value + l.toLowerCase()));
  // <FocusRegion>, not a plain box: without declared rows, every key is a
  // sibling in one flat list and Up/Down step through it diagonally.
  const row = (children: ReactNode, id: string) => (
    <FocusRegion key={id} style={{ flexDirection: 'row', gap: ROW_GAP, justifyContent: 'center' }}>
      {children}
    </FocusRegion>
  );
  return (
    // `grid`: keep the column when moving between rows, e.g. Down from T
    // reaches G, not wherever the next row was last left.
    <FocusColumn grid style={{ gap: ROW_GAP }}>
      {row(
        DIGITS.map((d) => key(d, d, () => onChange(value + d))),
        'digits',
      )}
      {letterRows.slice(0, -1).map((r) => row(r.map(letter), r.join('')))}
      {row(
        <>
          {lastRow.map(letter)}
          {glyph('space', 'space', GLYPH.space, () => onChange(`${value} `))}
          {glyph('delete', 'backspace', GLYPH.back, () => onChange(value.slice(0, -1)))}
          {glyph('close', 'x', GLYPH.close, () => onClose?.())}
        </>,
        'last',
      )}
    </FocusColumn>
  );
}

export type { SearchKeyboardProps };
export { SearchKeyboard };
