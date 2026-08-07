// The pieces that go inside <InputGroup.Root>: the control, and the addons
// that flank it.

import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, type StyleProp, type TextInput, type ViewStyle } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Button, type ButtonProps } from '#ui/components/atoms/button';
import { Txt } from '#ui/components/atoms/text';
import { TextArea, type TextAreaProps } from '#ui/components/atoms/text-area';
import { TextField, type TextFieldProps } from '#ui/components/atoms/text-field';
import { styles } from '#ui/core';
import { nestedRadius } from '#ui/core/tokens';
import {
  type AddonAlign,
  AddonContext,
  INSET,
  useAddonAlign,
  useInputGroup,
} from './input-group-context';

/** The entry, stripped of the shell it usually draws: inside a group the box,
 *  the border, the corner and the focus ring all belong to the Root. */
function GroupInput(props: Readonly<Omit<TextFieldProps, 'size'>>) {
  const group = useInputGroup('Input');
  const entry = useRef<TextInput>(null);
  const { registerFocus, onFocusChange, padStart, padEnd, invalid } = group;
  const focus = useCallback(() => entry.current?.focus(), []);
  useEffect(() => registerFocus(focus), [registerFocus, focus]);
  return (
    <TextField
      flex={1}
      minW={0}
      ring={false}
      borderWidth={0}
      bg="transparent"
      radius={0}
      pl={padStart}
      pr={padEnd}
      invalid={invalid}
      {...props}
      entryRef={entry}
      onFocus={() => {
        onFocusChange(true);
        props.onFocus?.();
      }}
      onBlur={() => {
        onFocusChange(false);
        props.onBlur?.();
      }}
    />
  );
}

/** The multi-line entry. Same deal, and the one the block addons are for. */
function GroupTextarea(props: Readonly<Omit<TextAreaProps, 'size'>>) {
  const { onFocusChange, padStart, padEnd, invalid } = useInputGroup('Textarea');
  return (
    <TextArea
      flex={1}
      minW={0}
      ring={false}
      borderWidth={0}
      bg="transparent"
      radius={0}
      pl={padStart}
      pr={padEnd}
      invalid={invalid}
      {...props}
      onFocus={() => {
        onFocusChange(true);
        props.onFocus?.();
      }}
      onBlur={() => {
        onFocusChange(false);
        props.onBlur?.();
      }}
    />
  );
}

interface AddonProps {
  /** Where it sits, not where it is written: the Root reads this and renders
   *  the buckets in visual order, since Yoga has no `order`. */
  align?: AddonAlign;
  /** A hairline between a block addon and the entry, the way a code editor
   *  rules off its filename bar. */
  divider?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

function Addon({
  align = 'inline-start',
  divider = false,
  onPress,
  style,
  children,
}: Readonly<AddonProps>) {
  const { metrics, focusControl } = useInputGroup('Addon');
  const block = align.startsWith('block');
  // Every addon sits on the entry's own margin, so a bar's first word lines up
  // with the text under it. A button is the exception and pulls ITSELF in.
  const body = (
    <Box
      row
      align="center"
      gap={8}
      px={metrics.px}
      // A bar is a control row like any other: the same height as the entry
      // beside it, whether it holds a button or only a word.
      py={block ? INSET : 0}
      minH={block ? metrics.height : undefined}
      style={[
        block ? s.blockAddon : null,
        divider && align === 'block-start' ? s.ruleBelow : null,
        divider && align === 'block-end' ? s.ruleAbove : null,
        style,
      ]}
    >
      {children}
    </Box>
  );
  // Pressing the padding types into the entry, which is what a field does
  // everywhere else. A block addon is a bar of its own controls, so it does
  // not steal the caret; and a button inside an addon wins the responder, so
  // it never reaches here either.
  const inside = <AddonContext.Provider value={align}>{body}</AddonContext.Provider>;
  if (block) return inside;
  return (
    <Pressable
      onPress={() => {
        onPress?.();
        focusControl();
      }}
    >
      {inside}
    </Pressable>
  );
}

/** A button that lives inside the shell: the shell's height minus its inset,
 *  with the corner that leaves the two concentric. */
function GroupButton({ style, ...props }: Readonly<ButtonProps>) {
  const { metrics } = useInputGroup('Button');
  const align = useAddonAlign();
  const shape = useMemo<ViewStyle>(() => {
    // The pull-in: the shell's text margin would leave a button that nearly
    // fills the box floating a whole character-width off its own edge. A bar
    // has the room, so a block addon keeps the margin.
    const pull = -(metrics.px - INSET);
    return {
      minHeight: metrics.height - INSET * 2,
      paddingVertical: 0,
      paddingHorizontal: 12,
      borderRadius: nestedRadius(metrics.radius, INSET),
      ...(align === 'inline-start' ? { marginLeft: pull } : null),
      ...(align === 'inline-end' ? { marginRight: pull } : null),
    };
  }, [metrics, align]);
  return <Button variant="ghost" size="sm" {...props} style={[shape, style]} />;
}

/** Unit text inside an addon: a currency, a scheme, a count. */
function GroupText({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Txt variant="meta" color="textDim">
      {children}
    </Txt>
  );
}

const s = styles({
  blockAddon: { w: '100%' },
  ruleBelow: { border: 'border', borderWidth: 0, borderBottomWidth: 1 },
  ruleAbove: { border: 'border', borderWidth: 0, borderTopWidth: 1 },
});

export type { AddonProps };
export { Addon, GroupButton, GroupInput, GroupText, GroupTextarea };
