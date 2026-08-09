// Tells the room what the phone is about to show. Renders nothing until this TV
// actually has a beacon up, so a server without handoff (or a TV reaching one
// from off the local network) simply never mentions it.

import { useT } from '@kroma/ui';
import { Box, styles, Txt } from '@kroma/ui/kit';
import { useHandoffBeacon } from '#tv/features/accounts/HandoffBeaconProvider';

/** The check string is printed here and nowhere else: it is the one thing a
 * person can compare between this screen and the row on their phone, which is
 * what makes picking the right TV a decision rather than a guess. */
export function HandoffHint({ mt = 0 }: Readonly<{ mt?: number }>) {
  const t = useT();
  const beacon = useHandoffBeacon();
  if (!beacon) return null;

  return (
    <Box align="center" gap={12} mt={mt}>
      <Txt style={s.line} color="textMuted">
        {t('handoff.tvHint', { name: beacon.name })}
      </Txt>
      <Box row align="center" gap={10} px={18} py={9} radius="pill" border="border" bg="surface2">
        <Box w={8} h={8} radius="pill" bg="accent" />
        <Txt style={s.check} color="accent">
          {t('handoff.tvCheck', { check: beacon.check })}
        </Txt>
      </Box>
    </Box>
  );
}

const s = styles({
  line: { fontSize: 16, fontWeight: '500', textAlign: 'center', maxW: 620 },
  check: { fontSize: 15, fontWeight: '700', letterSpacing: 1.2 },
});
