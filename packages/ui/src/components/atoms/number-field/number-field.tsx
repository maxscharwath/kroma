// <NumberField>: a compact numeric entry. The buffer is text (so a cleared
// field can be retyped), and what is committed is always what is on screen: a
// real number is committed as typed, a blank commits nothing (a blank is
// `Number('') === 0`, which would silently commit 0 and bypass `min`), and
// blur normalizes - clamps to the bounds and rewrites the text to the number
// actually stored, so the field can never show 15 while holding 64.

import { useRef, useState } from 'react';
import { TextField, type TextFieldProps } from '#ui/components/atoms/text-field';

interface NumberFieldProps
  extends Omit<TextFieldProps, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function clampTo(n: number, min?: number, max?: number): number {
  let out = n;
  if (min !== undefined) out = Math.max(min, out);
  if (max !== undefined) out = Math.min(max, out);
  return out;
}

/** `0.7 + 0.1` is `0.7999...`; a step's own decimal places say how far to round. */
function snapTo(n: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number(n.toFixed(decimals));
}

function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  w = 128,
  autoFocus = false,
  ...field
}: Readonly<NumberFieldProps>) {
  const [text, setText] = useState(() => String(value));
  // Adjusted during render, not in an effect, so an outside change (a reset
  // button, a poll) lands without a frame of the stale number.
  const seen = useRef(value);
  if (value !== seen.current) {
    seen.current = value;
    if (Number(text.trim()) !== value) setText(String(value));
  }

  const commit = (n: number) => {
    seen.current = n;
    if (n !== value) onChange(n);
  };

  const edit = (raw: string) => {
    setText(raw);
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const n = Number(trimmed);
    if (Number.isNaN(n)) return;
    commit(n);
  };

  // The bounds apply when the entry SETTLES, not per keystroke: clamping '1'
  // to a min of 64 while someone is still typing '150' would store a number
  // the field never showed.
  const settle = () => {
    const n = Number(text.trim());
    const bounded = clampTo(Number.isNaN(n) || text.trim() === '' ? value : n, min, max);
    setText(String(bounded));
    commit(bounded);
  };

  const nudge = (direction: -1 | 1) => {
    const by = step ?? 1;
    const bounded = clampTo(snapTo(value + direction * by, by), min, max);
    setText(String(bounded));
    commit(bounded);
  };

  return (
    <TextField
      {...field}
      w={w}
      type="number"
      autoFocus={autoFocus}
      value={text}
      onChange={edit}
      onBlur={settle}
      // A physical keyboard steps with the arrows, the way a native number
      // input does. On the container, where react-native-web delivers the
      // bubbled event from the focused entry.
      onKeyDown={(event) => {
        const key = event.nativeEvent.key;
        if (key === 'ArrowUp') nudge(1);
        else if (key === 'ArrowDown') nudge(-1);
      }}
    />
  );
}

export type { NumberFieldProps };
export { NumberField };
