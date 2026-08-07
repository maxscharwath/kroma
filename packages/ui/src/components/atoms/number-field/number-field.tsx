// <NumberField>: a compact numeric entry. The buffer is text (so a cleared
// field can be retyped), but only a real number is ever committed - a blank is
// `Number('') === 0`, which would silently commit 0 and bypass `min`.

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

function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  w = 128,
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

  const edit = (raw: string) => {
    setText(raw);
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const n = Number(trimmed);
    if (Number.isNaN(n)) return;
    const bounded = clampTo(n, min, max);
    seen.current = bounded;
    if (bounded !== value) onChange(bounded);
  };

  const nudge = (direction: -1 | 1) => {
    const bounded = clampTo(value + direction * (step ?? 1), min, max);
    seen.current = bounded;
    setText(String(bounded));
    if (bounded !== value) onChange(bounded);
  };

  return (
    <TextField
      {...field}
      w={w}
      type="number"
      value={text}
      onChange={edit}
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
