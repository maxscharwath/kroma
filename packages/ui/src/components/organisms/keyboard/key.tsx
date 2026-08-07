// One key of an <OnScreenKeyboard>. A <Focusable>, so the spatial focus nav
// reaches it and OK activates it.

import type { TextStyle, ViewStyle } from 'react-native';
import { Focusable } from '#ui/components/atoms/focusable';
import { Icon, type IconName, type IconProps } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { type StyleDecl, styles, svFor } from '#ui/core';
import { CONTROL } from '#ui/lib/field-shell';

// The focused key: the URL keyboard tints amber, the search keyboard fills solid
// for a stronger 10-foot cue at its larger size.
const keyFace = svFor<{
  root: StyleDecl;
  glyph: Pick<IconProps, 'color' | 'stroke'>;
  label: StyleDecl;
}>()({
  slots: {
    // The same well the field above sits in (lib/field-shell), opaque: a key
    // is a control, not a wash. Over artwork a translucent tint let every key
    // sample whatever was behind it, so one keyboard arrived in six colours.
    root: { center: true, radius: 16, bg: CONTROL.md.bg },
    glyph: { color: 'text', stroke: 1.8 },
    label: { color: 'text' },
  },
  variants: {
    tone: {
      url: {
        root: { _focus: { bg: 'accent/18' } },
        glyph: { _focus: { color: 'accent' } },
        label: { _focus: { color: 'accent' } },
      },
      search: {
        root: { _focus: { bg: 'accent' } },
        glyph: { _focus: { color: 'accentInk' } },
        label: { _focus: { color: 'accentInk' } },
      },
    },
  },
});

type KeyTone = 'url' | 'search';

interface KeyProps {
  label?: string;
  icon?: IconName;
  iconSize?: number;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  tone: KeyTone;
  autoFocus?: boolean;
}

function Key({
  label,
  icon,
  iconSize,
  onPress,
  style,
  textStyle,
  tone,
  autoFocus,
}: Readonly<KeyProps>) {
  return (
    <Focusable
      onPress={onPress}
      label={label}
      autoFocus={autoFocus}
      focusScale={1.08}
      ring={false}
      sv={keyFace}
      vars={{ tone }}
      style={style}
    >
      {({ slots }) =>
        icon ? (
          <Icon name={icon} size={iconSize ?? 24} {...slots.glyph} />
        ) : (
          <Txt style={[slots.label, keyStyles.label, textStyle]}>{label}</Txt>
        )
      }
    </Focusable>
  );
}

// Module scope, not a render body: this hands the same style identity to ~40
// keys on every keystroke instead of rebuilding it each time.
const keyStyles = styles({
  label: { fontWeight: '700' },
});

export type { KeyProps, KeyTone };
export { Key, keyFace };
