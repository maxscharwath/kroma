import { Box, Focusable, Icon, type IconName, Txt } from '@kroma/ui/kit';
import type { ReactNode } from 'react';

/** One focusable settings row (icon + label + trailing value or chevron),
 * shared by the profile menu and the signed-out device-settings screen. */
export function MenuRow({
  icon,
  label,
  onAct,
  children,
}: Readonly<{
  icon: IconName;
  label: string;
  onAct: () => void;
  children?: ReactNode;
}>) {
  return (
    <Focusable
      onPress={onAct}
      label={label}
      focusScale={1.02}
      ring={false}
      style={ROW}
      focusedStyle={FOCUSED}
    >
      <Box w={42} h={42} shrink={0} center radius="xl" bg="rgba(255, 255, 255, 0.06)">
        <Icon name={icon} size={20} color="textMuted" />
      </Box>
      <Txt style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>{label}</Txt>
      {children ?? <Icon name="chevron-right" size={20} color="textDim" />}
    </Focusable>
  );
}

const ROW = {
  width: '100%' as const,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 16,
  borderRadius: 15,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.08)',
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  paddingHorizontal: 20,
  paddingVertical: 16,
};

const FOCUSED = { borderColor: '#F4B642' };
