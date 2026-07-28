import { Box } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { colors } from '#ui/lib/tokens';
import { useT } from '#ui/services/i18n';
import { GUTTER, scaler } from '../lib/metrics';

/**
 * Skip-intro pill (§13): a bottom-right "Passer l'intro" button shown only
 * during the detected intro window. Focus is state-driven (controlled kit
 * button - `focused` is ALWAYS passed, see ../lib/virtual-focus.ts), so on
 * focus the scrim pill flips to the primary variant: accent fill, ink label,
 * the kit's ring and scale. The variant swap is what expresses the design's
 * "amber when focused" without a bespoke control.
 * Sits above where the control bar mounts, so the two never overlap.
 */
export interface SkipIntroButtonProps {
  visible: boolean;
  focused: boolean;
  /** The chrome's scale (see ../lib/metrics). 1 on a television stage. */
  scale?: number;
  onSkip: () => void;
}

/** How high the pill sits: clear of the control bar it must never overlap. */
const LIFT = 214;

export function SkipIntroButton({
  visible,
  focused,
  scale = 1,
  onSkip,
}: Readonly<SkipIntroButtonProps>) {
  const t = useT();
  const px = scaler(scale);
  if (!visible) return null;
  // Scaled with the rest of the chrome, and off the SAME gutter: unscaled, this
  // sat on a 34px margin while the row beneath it had shrunk to 27, so the two
  // right edges visibly disagreed in any window narrower than the design.
  return (
    <Box absolute bottom={px(LIFT)} right={px(GUTTER)} z={30}>
      <Button
        variant={focused ? 'primary' : 'scrim'}
        focused={focused}
        onPress={onSkip}
        label={t('player.skipIntro')}
        iconRight="chevron-right"
        // The scrim variant carries a 1px border and primary none; pinning the
        // border on the focused state too keeps the pill's box from shifting a
        // pixel when focus lands.
        style={focused ? FOCUS_EDGE : null}
      />
    </Box>
  );
}

const FOCUS_EDGE = { borderWidth: 1, borderColor: colors.accent } as const;
