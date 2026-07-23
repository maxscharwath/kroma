import { useT } from '@kroma/ui';
import { Box, colors, Focusable, Icon, screenEntry } from '@kroma/ui/kit';
import { useNav } from '#tv/app/router';

/**
 * The on-screen Back affordance for the 10-foot app.
 *
 * It sits alone in the top-left corner, which is the hardest place on a screen
 * for a television to reason about: focus moves in a straight band, so a corner
 * button has nothing beneath it (the content is centred) and nothing beside it.
 * Left as-is it could be entered and never left - measured on an Apple TV, and
 * the reason it was once made unfocusable there.
 *
 * It is reachable and escapable like anything else: the row model puts it on
 * the same line as the brand mark and the nav pill, and Down leads to whatever
 * the screen puts below.
 *
 * The remote has Back regardless: every screen wires `useFocusNav` -> `onBack`,
 * the Menu key raises it, and each screen's hint line says so. This button is
 * the pointer's equivalent of that key.
 *
 * Renders nothing at the root of the stack (unless an explicit `onPress` is
 * given), so there is never a dead Back control.
 */
export function TvBackButton({ onPress }: Readonly<{ onPress?: () => void }>) {
  const nav = useNav();
  const t = useT();
  if (!onPress && !nav.canGoBack) return null;
  const act = onPress ?? nav.back;

  const glyph = (focused: boolean) => (
    <Box w={44} h={44} shrink={0} center radius="pill" style={focused ? FOCUSED : BUTTON}>
      <Icon name="chevron-left" size={22} stroke={2} color={focused ? 'accentInk' : 'text'} />
    </Box>
  );

  return (
    <Focusable
      onPress={act}
      label={t('common.back')}
      focusScale={1.08}
      ring={false}
      neighbours={BACK_OUT}
    >
      {({ focused }) => glyph(focused)}
    </Focusable>
  );
}

/** Alone in a corner with the content centred, Down finds nothing; the way back
 * into the page is declared rather than searched for. */
const BACK_OUT = { down: screenEntry };

const BUTTON = {
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: 'rgba(10, 10, 12, 0.78)',
} as const;

/** Focused it fills amber, like every other primary control in the design. */
const FOCUSED = {
  borderWidth: 1,
  borderColor: colors.accent,
  backgroundColor: colors.accent,
} as const;
