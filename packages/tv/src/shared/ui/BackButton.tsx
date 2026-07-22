import { useT } from '@kroma/ui';
import { Box, Icon } from '@kroma/ui/kit';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { useNav } from '#tv/app/router';

/**
 * Pointer-first Back affordance for the 10-foot app. The remote already has a
 * dedicated Back key (wired per screen through useFocusNav -> onBack), so this
 * button exists for MOUSE users (the desktop shell, an LG Magic-Remote pointer):
 * every screen that can go back now shows something clickable.
 *
 * It is a bare Pressable rather than a <Focusable> on purpose: staying out of
 * the spatial-focus set means it never steals the initial focus from a screen's
 * primary action, which keeps the tuned remote UX intact. Renders nothing at the
 * root of the stack (unless an explicit `onPress` is given), so there is never a
 * dead Back control.
 *
 * The hover tint is colour-only, and it comes from pointer events rather than
 * react-native-web's `hovered` state so the component stays platform-neutral (a
 * TV simply never fires them).
 */
export function TvBackButton({ onPress }: Readonly<{ onPress?: () => void }>) {
  const nav = useNav();
  const t = useT();
  const [hovered, setHovered] = useState(false);
  if (!onPress && !nav.canGoBack) return null;
  return (
    <Pressable
      onPress={onPress ?? nav.back}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      focusable={false}
      tabIndex={-1}
    >
      <Box
        w={44}
        h={44}
        shrink={0}
        center
        radius="pill"
        border="border"
        bg="rgba(10, 10, 12, 0.78)"
      >
        <Icon name="chevron-left" size={22} stroke={2} color={hovered ? 'accent' : 'text'} />
      </Box>
    </Pressable>
  );
}
