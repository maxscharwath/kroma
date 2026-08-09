// The fast half of "connect a device": the TVs waiting on this network, one tap
// each. Everything it decides lives in `useNearbyTvs`; this brings the rows.
//
// Two ways of looking here, not one: the server, and this phone's own link when
// the binary carries the native module. A television heard on the link can be
// signed in even where the server could not tell the two apart.
//
// Renders nothing while nothing is waiting and nothing has been connected: an
// empty box above the camera would only ask the reader to work out whether it
// is broken.

import { useNearbyTvs } from '@kroma/core/react';
import { lanBeacon } from '@kroma/lan-beacon';
import { Box, Icon, ListRow, Spinner, styles, Txt } from '@kroma/ui/kit';
import { useT } from '#mobile/lib/i18n';
import { useClient } from '#mobile/lib/session';
import { colors, spacing, type } from '#mobile/lib/theme';

export function NearbyTvs() {
  const t = useT();
  const client = useClient();
  const { devices, connecting, connected, failed, connect } = useNearbyTvs({
    client,
    lan: lanBeacon ?? undefined,
  });

  if (devices.length === 0 && !connected) return null;

  return (
    <Box style={s.section}>
      <Txt style={s.title}>{t('handoff.nearbyTitle')}</Txt>
      <Txt style={s.sub}>{t('handoff.nearbySub')}</Txt>

      {connected ? (
        <Txt style={s.connected}>{t('handoff.connected', { name: connected.name })}</Txt>
      ) : null}
      {failed ? <Txt style={s.failed}>{t('handoff.gone')}</Txt> : null}

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

      <Box style={s.divider}>
        <Icon name="chevron-down" size={16} color={colors.textDim} />
        <Txt style={s.otherWays}>{t('handoff.otherWays')}</Txt>
      </Box>
    </Box>
  );
}

const s = styles({
  section: { w: '100%', gap: 6 },
  title: { ...type.title, fontSize: 17 },
  sub: { ...type.caption, color: 'textDim', marginBottom: spacing.sm },
  connected: { ...type.caption, color: 'success', fontWeight: '700' },
  failed: { ...type.caption, color: 'danger', fontWeight: '700' },
  divider: { align: 'center', gap: 4, marginTop: spacing.md },
  otherWays: { ...type.caption, color: 'textDim', fontWeight: '600' },
});
