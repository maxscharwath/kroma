import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Txt } from '../../primitives/Text';
import { Box } from '../../system/Box';
import { IconOk } from '../icons';
import { rowStyle, selectLabel, selectRow, selectRowOff, selectRowOn, selectSub } from './panelStyle';

/**
 * One row of a settings sub-list (Quality / Audio / Subtitles / Speed / audio
 * filter): a label, an optional sub-line, an accent check when it is the current
 * value, and an optional trailing control.
 *
 * Every one of those panels had this markup spelled out; extracting it is what
 * keeps them looking identical. Focus is the `focused` PROP, not CSS state: the
 * panel's list navigation owns which row is current, and a pointer entering a
 * row moves that selection exactly as the D-pad would (§15).
 */
export function SelectRow({
  label,
  sub,
  selected,
  focused,
  onActivate,
  onFocus,
  leading,
  trailing,
}: Readonly<{
  label: ReactNode;
  sub?: ReactNode;
  selected?: boolean;
  focused: boolean;
  onActivate: () => void;
  onFocus: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}>) {
  return (
    <Pressable
      onPress={onActivate}
      onPointerEnter={onFocus}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      style={rowStyle(selectRow, selectRowOn, selectRowOff, focused)}
    >
      {leading}
      <Box flex style={{ minWidth: 0 }}>
        {typeof label === 'string' ? <Txt style={selectLabel}>{label}</Txt> : label}
        {sub == null ? null : typeof sub === 'string' ? <Txt style={selectSub}>{sub}</Txt> : sub}
      </Box>
      {trailing}
      {selected ? <IconOk size={24} color="accent" /> : null}
    </Pressable>
  );
}
