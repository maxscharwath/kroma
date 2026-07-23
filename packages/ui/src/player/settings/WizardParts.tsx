import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { colors, fonts } from '../../lib/tokens';
import { Box } from '../../ui/primitives/box';
import { Txt } from '../../ui/primitives/text';
import { FOCUS_SHADOW_SM } from '../style';
import { VIRTUAL_FOCUS } from '../virtual-focus';

/**
 * Presentational atoms for the {@link GenerateWizard}, kept out of the wizard so
 * each file stays small. Focus is state-driven (§15): a pointer entering a field
 * calls `onFocus`, and a `focused` boolean draws the ring, never CSS :hover.
 */

const CYCLE_ROW = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  gap: 18,
  borderRadius: 14,
  paddingHorizontal: 22,
  paddingVertical: 18,
};

/** A ◀ value ▶ cycle field (mode / language / quality / source picking). ▲▼ move
 * between fields, ◀▶ change the focused field's value. */
export function CycleField({
  label,
  value,
  focused,
  onFocus,
  onDec,
  onInc,
}: Readonly<{
  label: string;
  value: string;
  focused: boolean;
  onFocus: () => void;
  onDec: () => void;
  onInc: () => void;
}>) {
  return (
    <Box
      onPointerEnter={onFocus}
      style={[
        CYCLE_ROW,
        focused
          ? { backgroundColor: 'rgba(255, 255, 255, 0.08)', boxShadow: FOCUS_SHADOW_SM }
          : { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
      ]}
    >
      <Txt style={FIELD_LABEL}>{label}</Txt>
      <Box row align="center" gap={16}>
        <CycleArrow glyph="◀" label="prev" dim={!focused} onPress={onDec} />
        <Txt style={FIELD_VALUE}>{value}</Txt>
        <CycleArrow glyph="▶" label="next" dim={!focused} onPress={onInc} />
      </Box>
    </Box>
  );
}

function CycleArrow({
  glyph,
  label,
  dim,
  onPress,
}: Readonly<{ glyph: string; label: string; dim: boolean; onPress: () => void }>) {
  return (
    <Pressable
      {...VIRTUAL_FOCUS}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Txt
        style={{ fontSize: 20, lineHeight: 22, paddingHorizontal: 4, opacity: dim ? 0.45 : 1 }}
        color="accent"
      >
        {glyph}
      </Txt>
    </Pressable>
  );
}

const FIELD_LABEL = {
  fontFamily: fonts.ui,
  fontWeight: '600' as const,
  fontSize: 17,
  color: 'rgba(244, 243, 240, 0.62)',
};

const FIELD_VALUE = {
  minWidth: 180,
  textAlign: 'center' as const,
  fontFamily: fonts.ui,
  fontWeight: '700' as const,
  fontSize: 19,
};

/** The full-width wizard action button (amber when focused). */
export function ActionButton({
  label,
  focused,
  disabled,
  onFocus,
  onPress,
  children,
}: Readonly<{
  label: string;
  focused: boolean;
  disabled?: boolean;
  onFocus: () => void;
  onPress: () => void;
  children?: ReactNode;
}>) {
  const tone = actionTone(Boolean(disabled), focused);
  return (
    <Pressable
      {...VIRTUAL_FOCUS}
      onPress={disabled ? undefined : onPress}
      onPointerEnter={onFocus}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[ACTION, tone.box]}
    >
      {children}
      <Txt style={{ fontFamily: fonts.ui, fontWeight: '700', fontSize: 18 }} color={tone.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

function actionTone(disabled: boolean, focused: boolean) {
  if (disabled) {
    return {
      box: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
      ink: 'rgba(244, 243, 240, 0.4)',
    };
  }
  if (focused) {
    return {
      box: { backgroundColor: colors.accent, boxShadow: FOCUS_SHADOW_SM },
      ink: colors.accentInk,
    };
  }
  return { box: { backgroundColor: 'rgba(255, 255, 255, 0.08)' }, ink: colors.text };
}

const ACTION = {
  marginTop: 4,
  width: '100%' as const,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 10,
  borderRadius: 14,
  paddingVertical: 18,
};
