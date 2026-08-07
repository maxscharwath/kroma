// The search keyboard: the layout's letters as-is, with space / backspace /
// close appended to the short tail row. Letters insert lowercase, since search
// is case-insensitive.

import type { ReactNode } from 'react';
import type { IconName } from '#ui/components/atoms/icon';
import { FocusColumn, FocusRegion } from '#ui/lib/focus-scope';
import { Key } from './key';
import { type KeyboardLayout, LAYOUT_LETTER_ROWS } from './keyboard-layouts';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

// Typewriter layouts (10 keys/row) get fixed near-square keys so the column
// stays uniform; the ABC grid keeps its original roomy 6-column flex layout.
function searchLook(layout: KeyboardLayout) {
  const letterRows = LAYOUT_LETTER_ROWS[layout];
  const wide = letterRows.some((r) => r.length > 6);
  return {
    letterRows,
    lastRow: letterRows.at(-1) ?? [],
    wide,
    face: wide ? { height: 48, width: 44, flexShrink: 0 } : { height: 56, flex: 1 },
    text: { fontSize: wide ? 19 : 22 },
    rowGap: wide ? 8 : 12,
    // The three trailing-row glyphs are optically balanced against each other,
    // so they are sized together here rather than each at its own call site.
    icon: wide ? { space: 24, back: 22, close: 20 } : { space: 28, back: 26, close: 24 },
  };
}

interface SearchKeyboardProps {
  value: string;
  onChange: (next: string) => void;
  onClose?: () => void;
  layout: KeyboardLayout;
}

function SearchKeyboard({ value, onChange, onClose, layout }: Readonly<SearchKeyboardProps>) {
  const { letterRows, lastRow, wide, face, text, rowGap, icon } = searchLook(layout);
  const key = (id: string, label: string, onPress: () => void) => (
    <Key key={id} label={label} onPress={onPress} style={face} textStyle={text} tone="search" />
  );
  const glyph = (id: string, name: IconName, size: number, onPress: () => void) => (
    <Key key={id} icon={name} iconSize={size} onPress={onPress} style={face} tone="search" />
  );
  const letter = (l: string) => key(l, l, () => onChange(value + l.toLowerCase()));
  // <FocusRegion>, not a plain box: without declared rows, every key is a
  // sibling in one flat list and Up/Down step through it diagonally.
  const row = (children: ReactNode, id: string) => (
    <FocusRegion
      key={id}
      style={{
        flexDirection: 'row',
        gap: rowGap,
        justifyContent: wide ? 'center' : undefined,
      }}
    >
      {children}
    </FocusRegion>
  );
  return (
    // `grid`: keep the column when moving between rows, e.g. Down from T
    // reaches G, not wherever the next row was last left.
    <FocusColumn grid style={{ gap: rowGap }}>
      {row(
        DIGITS.map((d) => key(d, d, () => onChange(value + d))),
        'digits',
      )}
      {letterRows.slice(0, -1).map((r) => row(r.map(letter), r.join('')))}
      {row(
        <>
          {lastRow.map(letter)}
          {glyph('space', 'space', icon.space, () => onChange(`${value} `))}
          {glyph('delete', 'backspace', icon.back, () => onChange(value.slice(0, -1)))}
          {glyph('close', 'x', icon.close, () => onClose?.())}
        </>,
        'last',
      )}
    </FocusColumn>
  );
}

export type { SearchKeyboardProps };
export { SearchKeyboard };
