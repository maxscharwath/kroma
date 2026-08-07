// On a TV, typing goes through the on-screen keyboard, so the field renders as a
// non-focusable value plus caret - nothing may invite a click that summons the
// platform IME.

import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { type StyleProp, TextInput, type TextInputProps, type TextStyle } from 'react-native';
import { Box, type BoxProps } from '#ui/components/atoms/box';
import { Focusable } from '#ui/components/atoms/focusable';
import { Icon, type IconName } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { styles, useTheme } from '#ui/core';
import { Caret } from '#ui/lib/caret';
import {
  type ControlSize,
  controlMetrics,
  edgeColor,
  entryDefaultPhysicalKeyboard,
  fieldRing,
  NO_OUTLINE,
  PLACEHOLDER,
} from '#ui/lib/field-shell';
import { useControllable } from '#ui/lib/use-controllable';

type TextFieldType = 'text' | 'email' | 'password' | 'url' | 'search' | 'number';

const TYPE_PROPS: Record<TextFieldType, Partial<TextInputProps>> = {
  text: {},
  email: { keyboardType: 'email-address', autoComplete: 'email', inputMode: 'email' },
  password: { autoComplete: 'current-password' },
  url: { keyboardType: 'url', inputMode: 'url' },
  search: { inputMode: 'search', returnKeyType: 'search' },
  number: { keyboardType: 'numeric', inputMode: 'numeric' },
};

interface TextFieldProps extends Omit<BoxProps, 'children' | 'onChange' | 'ring'> {
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  type?: TextFieldType;
  onSubmit?: () => void;
  /** After the entry takes focus. A shell drawn AROUND this field (see
   *  <InputGroup>) paints the focus state the entry itself gives up. */
  onFocus?: () => void;
  /** After the entry loses focus: the commit point of a save-on-blur field. */
  onBlur?: () => void;
  /** The entry itself, for a caller that has to focus it from outside: give it
   *  a ref and the field uses it instead of its own. */
  entryRef?: RefObject<TextInput | null>;
  placeholder?: string;
  icon?: IconName;
  trailing?: ReactNode;
  physicalKeyboard?: boolean;
  autoFocus?: boolean;
  /** Explicit override; normally derived from `type`. */
  keyboardType?: 'default' | 'url' | 'email-address';
  /** Explicit override; normally derived from `type`. A registration form's
   *  password field says `new-password` here, or the browser's manager fills
   *  the CURRENT password into it and never offers to generate one. */
  autoComplete?: TextInputProps['autoComplete'];
  invalid?: boolean;
  /** A value to read and copy, not to change: the entry still focuses and
   *  still selects, so a share link can be picked up with the keyboard. */
  readOnly?: boolean;
  /** Select the whole value when the entry takes focus, which is what a
   *  one-shot value (a link, a token) wants: focus it and copy it. */
  selectOnFocus?: boolean;
  label?: string;
  /** The control shell's size. Defaults to the app's (`setEntryDefaults`):
   *  `md` reads at ten feet, `sm` is a console page's density. */
  size?: ControlSize;
  textStyle?: StyleProp<TextStyle>;
  /** The amber focus ring. Off for an entry flattened into other chrome (a
   *  command palette's search row), where the surrounding sheet is the focus
   *  surface and a ring would outline the wrong shape. */
  ring?: boolean;
}

function TextField({
  value: valueProp,
  defaultValue = '',
  onChange,
  type = 'text',
  onSubmit,
  onFocus,
  onBlur,
  entryRef,
  placeholder,
  icon,
  trailing,
  physicalKeyboard = entryDefaultPhysicalKeyboard(),
  autoFocus = true,
  keyboardType,
  autoComplete,
  invalid = false,
  readOnly = false,
  selectOnFocus = false,
  label,
  size,
  textStyle,
  ring = true,
  ...box
}: Readonly<TextFieldProps>) {
  const theme = useTheme();
  const metrics = controlMetrics(size);
  const CONTENT = metrics.line;
  const [value, setValue] = useControllable(valueProp, defaultValue, onChange);
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const own = useRef<TextInput>(null);
  const input = entryRef ?? own;
  const keyboardProps = keyboardType ? { keyboardType } : null;
  const autoCompleteProps = autoComplete ? { autoComplete } : null;
  const masked = type === 'password' && !revealed;
  return (
    <Box
      row
      align="center"
      gap={metrics.gap}
      px={metrics.px}
      py={metrics.py}
      radius={metrics.radius}
      bg={metrics.bg}
      borderWidth={1}
      {...box}
      // The whole field is the caret's landing zone: tapping the icon or the
      // padding focuses the entry. Only presses no inner control claimed reach
      // here, and a drag stolen by a surrounding list never releases here.
      onStartShouldSetResponder={() => physicalKeyboard}
      onResponderRelease={() => input.current?.focus()}
      // The same amber ring every other control wears, rather than a 1px edge
      // recolour: a field is a focus target like any other and must read as one
      // from three metres.
      style={[
        { borderColor: edgeColor(focused, invalid) },
        focused && ring ? fieldRing() : null,
        box.style,
      ]}
    >
      {/* The well is fixed at the entry's content height so a leading icon can
          never set the row height. */}
      {icon ? (
        <Box w={CONTENT} h={CONTENT} center>
          <Icon name={icon} size={20} stroke={1.8} color="rgba(244, 243, 240, 0.5)" />
        </Box>
      ) : null}
      {physicalKeyboard ? (
        <TextInput
          ref={input}
          {...TYPE_PROPS[type]}
          value={value}
          onChangeText={setValue}
          onSubmitEditing={onSubmit}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          readOnly={readOnly}
          selectTextOnFocus={selectOnFocus}
          placeholder={placeholder}
          placeholderTextColor={PLACEHOLDER}
          accessibilityLabel={label}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          secureTextEntry={masked}
          {...keyboardProps}
          {...autoCompleteProps}
          selectionColor={theme.colors.accent}
          style={[
            s.input,
            NO_OUTLINE,
            { color: theme.colors.text, minHeight: CONTENT, fontSize: metrics.fontSize },
            textStyle,
          ]}
        />
      ) : (
        <Box row align="center" flex gap={2} h={CONTENT}>
          <Txt
            lines={1}
            style={[{ flexShrink: 1 }, textStyle]}
            color={value ? 'text' : PLACEHOLDER}
          >
            {(masked ? '•'.repeat(value.length) : value) || placeholder || ''}
          </Txt>
          <Caret height={28} />
        </Box>
      )}
      {type === 'password' ? (
        <>
          {/* The reveal button is out of the layout - a spacer reserves its
              width, the button is absolutely positioned over it - because in
              flow its padding set the row height. */}
          <Box w={CONTENT} />
          <Box absolute style={s.revealSlot}>
            <Focusable
              label={revealed ? 'Hide password' : 'Show password'}
              ring={false}
              onPress={() => setRevealed((prev) => !prev)}
              style={s.reveal}
              states={REVEAL_STATES}
            >
              <Icon
                name={revealed ? 'eye-off' : 'eye'}
                size={REVEAL_SIZE}
                stroke={1.8}
                color="rgba(244, 243, 240, 0.5)"
              />
            </Focusable>
          </Box>
        </>
      ) : null}
      {trailing}
    </Box>
  );
}

const REVEAL_SIZE = 20;
const REVEAL_STATES = { hover: { bg: 'white/10' } } as const;

const s = styles({
  input: { flex: true, minW: 0, borderWidth: 0, bg: 'transparent', p: 0 },
  revealSlot: { right: 16, top: 0, bottom: 0, justify: 'center' },
  reveal: { p: 4, m: -4, radius: 'md' },
});

export type { TextFieldProps, TextFieldType };
export { TextField };
