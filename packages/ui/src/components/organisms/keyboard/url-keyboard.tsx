// The server-URL keyboard: ten keys a row, the layout's letters plus the URL
// specials, and a submit button on the tail row.

import { Button } from '#ui/components/atoms/button';
import { styles } from '#ui/core';
import { FocusColumn, FocusRegion } from '#ui/lib/focus-scope';
import { useTDefault } from '#ui/services/i18n';
import { Key } from './key';
import { DELETE_KEY, type KeyboardLayout, urlRows } from './keyboard-layouts';

interface UrlKeyboardProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  layout: KeyboardLayout;
}

function UrlKeyboard({
  value,
  onChange,
  onSubmit,
  submitLabel,
  layout,
}: Readonly<UrlKeyboardProps>) {
  // The keyboard is kit chrome: it must not make <I18nProvider> a mount
  // requirement for every screen that shows a keyboard.
  const t = useTDefault();
  const rows = urlRows(layout);
  const press = (k: string) => {
    if (k === DELETE_KEY) onChange(value.slice(0, -1));
    else onChange(value + k);
  };
  return (
    // `grid`: Down from a key lands on the key below it, not wherever the next
    // row was last left.
    <FocusColumn grid style={s.column}>
      {rows.map((row, rowIndex) => (
        <FocusRegion key={row.join('')} style={s.keyRow}>
          {row.map((k, keyIndex) => (
            <Key
              key={k}
              label={k === DELETE_KEY ? t('common.delete') : k}
              icon={k === DELETE_KEY ? 'backspace' : undefined}
              iconSize={26}
              autoFocus={rowIndex === 0 && keyIndex === 0}
              onPress={() => press(k)}
              style={s.key}
              textStyle={s.keyText}
              tone="url"
            />
          ))}
        </FocusRegion>
      ))}
      {/* Declared as a row: a plain box would make Left/Right do nothing
          between these three controls. */}
      <FocusRegion style={s.keyRow}>
        {/* An icon, never a symbol character: TV system fonts miss glyphs like
            U+2327 and draw a tofu box instead. */}
        <Key
          label={t('common.clear')}
          icon="eraser"
          iconSize={24}
          onPress={() => onChange('')}
          style={s.clearKey}
          tone="url"
        />
        <Key
          label="."
          onPress={() => onChange(`${value}.`)}
          style={s.key}
          textStyle={s.keyText}
          tone="url"
        />
        {onSubmit ? (
          <Button variant="primary" onPress={onSubmit} label={submitLabel} style={s.submit} />
        ) : null}
      </FocusRegion>
    </FocusColumn>
  );
}

const s = styles({
  column: { gap: 12 },
  key: { h: 52, flex: 1 },
  keyText: { fontSize: 20 },
  clearKey: { h: 52, flex: 2 },
  submit: { h: 52, flex: 3 },
  keyRow: { row: true, gap: 12 },
});

export type { UrlKeyboardProps };
export { UrlKeyboard };
