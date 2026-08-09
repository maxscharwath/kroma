// The televisions waiting on this network, one tap each. Everything it decides
// lives in `useNearbyTvs`; this brings the rows.
//
// Two ways of looking, not one: the server, and this phone's own link when the
// binary carries the native module. A television heard on the link can be signed
// in even where the server could not tell the two apart.
//
// It always says something. Rendering nothing while nothing is found reads as a
// broken screen rather than an empty network, and this is now a whole mode of
// the page somebody deliberately switched to - so "still looking" and "nothing
// here, and why" are the two answers it owes them.

import { useNearbyTvs } from '@kroma/core/react';
import { lanBeacon } from '@kroma/lan-beacon';
import { Box, ListRow, Spinner, styles, Txt } from '@kroma/ui/kit';
import { type ReactNode, useEffect, useState } from 'react';
import { useT } from '#mobile/lib/i18n';
import { useClient } from '#mobile/lib/session';
import { spacing, type } from '#mobile/lib/theme';

// A television answers the server poll in about a second and a link browse
// faster still, but "nothing here" the instant the mode opens is a lie the
// reader acts on. Hold the looking state long enough for one honest answer.
const SETTLE_MS = 4000;

export function NearbyTvs() {
  const t = useT();
  const client = useClient();
  const { devices, connecting, connected, failed, connect } = useNearbyTvs({
    client,
    lan: lanBeacon ?? undefined,
  });
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  let body: ReactNode;
  if (devices.length > 0) {
    body = (
      <ListRow.Group>
        {devices.map((device) => (
          <ListRow
            key={device.handle}
            size="sm"
            icon="device-tv"
            label={device.name}
            hint={device.platform}
            trailing={
              connecting?.handle === device.handle ? <Spinner size={18} thickness={2} /> : undefined
            }
            onPress={() => void connect(device)}
          />
        ))}
      </ListRow.Group>
    );
  } else if (!settled) {
    body = (
      <Box style={s.looking}>
        <Spinner size={16} thickness={2} />
        <Txt style={s.dim}>{t('handoff.nearbySearching')}</Txt>
      </Box>
    );
  } else {
    body = (
      <Box style={s.empty}>
        <Txt style={s.dim}>{t('handoff.nearbyEmpty')}</Txt>
        <Txt style={s.hint}>{t('handoff.nearbyEmptyHint')}</Txt>
      </Box>
    );
  }

  return (
    <Box style={s.section}>
      {connected ? (
        <Txt style={s.connected}>{t('handoff.connected', { name: connected.name })}</Txt>
      ) : null}
      {failed ? <Txt style={s.failed}>{t('handoff.gone')}</Txt> : null}
      {body}
    </Box>
  );
}

const s = styles({
  section: { w: '100%', gap: 6 },
  connected: { ...type.caption, color: 'success', fontWeight: '700' },
  failed: { ...type.caption, color: 'danger', fontWeight: '700' },
  looking: { row: true, align: 'center', gap: spacing.sm, py: spacing.sm },
  empty: { gap: 2, py: spacing.sm },
  dim: { ...type.caption, color: 'textDim' },
  hint: { ...type.caption, color: 'textDim', opacity: 0.8 },
});
