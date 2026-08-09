// The fast half of "connect a device": the TVs waiting on this network, one tap
// each. Everything it decides lives in `useNearbyTvs`; this brings the rows.
//
// Two ways of looking here, not one: the server, and this phone's own link when
// the binary carries the native module. A television heard on the link can be
// signed in even where the server could not tell the two apart.
//
// It always says something. Rendering nothing while nothing is found reads as a
// feature that does not exist - the reader never learns there was a faster road
// than the code below, nor that it is being looked for. So an empty list is a
// sentence about why it is empty, which is the one thing a silent box cannot be.

import { useNearbyTvs } from '@kroma/core/react';
import { lanBeacon } from '@kroma/lan-beacon';
import { Box, Icon, ListRow, Spinner, styles, Txt } from '@kroma/ui/kit';
import { type ReactNode, useEffect, useState } from 'react';
import { useT } from '#mobile/lib/i18n';
import { useClient } from '#mobile/lib/session';
import { colors, spacing, type } from '#mobile/lib/theme';

// A television answers the server poll in about a second and a link browse
// faster still, but "nothing here" the instant the screen opens is a lie the
// reader acts on. Hold the looking state long enough for one honest answer.
const SETTLE_MS = 4000;

export function NearbyTvs() {
  const t = useT();
  const client = useClient();
  const { devices, signedIn, connecting, connected, failed, connect } = useNearbyTvs({
    client,
    lan: lanBeacon ?? undefined,
  });
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  const anyFound = devices.length > 0 || signedIn.length > 0;
  const looking = !settled && !anyFound;

  let body: ReactNode;
  if (anyFound) {
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
        {signedIn.map((tv) => (
          <ListRow
            key={tv.receiverId}
            size="sm"
            icon="device-tv"
            label={tv.name}
            hint={t('handoff.nearbySignedIn')}
          />
        ))}
      </ListRow.Group>
    );
  } else if (looking) {
    body = (
      <Box style={s.state}>
        <Spinner size={16} thickness={2} />
        <Txt style={s.stateLabel}>{t('handoff.nearbySearching')}</Txt>
      </Box>
    );
  } else {
    body = (
      <Box style={s.state}>
        <Icon name="device-tv" size={16} color={colors.textDim} />
        <Box style={s.emptyText}>
          <Txt style={s.stateLabel}>{t('handoff.nearbyEmpty')}</Txt>
          <Txt style={s.emptyHint}>{t('handoff.nearbyEmptyHint')}</Txt>
        </Box>
      </Box>
    );
  }

  return (
    <Box style={s.section}>
      <Txt style={s.title}>{t('handoff.nearbyTitle')}</Txt>
      <Txt style={s.sub}>{t('handoff.nearbySub')}</Txt>

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
  title: { ...type.title, fontSize: 17 },
  sub: { ...type.caption, color: 'textDim', marginBottom: spacing.sm },
  connected: { ...type.caption, color: 'success', fontWeight: '700' },
  failed: { ...type.caption, color: 'danger', fontWeight: '700' },
  state: { row: true, align: 'center', gap: spacing.sm, py: spacing.sm },
  stateLabel: { ...type.caption, color: 'textDim' },
  emptyText: { fill: true, gap: 2 },
  emptyHint: { ...type.caption, color: 'textDim', opacity: 0.8 },
});
