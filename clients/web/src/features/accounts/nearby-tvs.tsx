import type { DiscoveredTv } from '@kroma/core';
import { useNearbyTvs } from '@kroma/core/react';
import { useT } from '@kroma/ui';
import { Icon, ListRow, Spinner, Txt } from '@kroma/ui/kit';
import { useAuth } from '#web/shared/lib/auth';

// The fast half of "connect a device": the TVs waiting on this network, one tap
// each. Everything it decides lives in `useNearbyTvs`; this brings the rows.
//
// A browser cannot listen to its own link, so the server is this shell's only
// source. The phone app passes a second one.
//
// It renders nothing at all when nothing is waiting and nothing has been
// connected: an empty box above the code field would only ask the reader to
// work out whether it is broken.

function trailing(device: DiscoveredTv, connecting: string | null, connected: string | null) {
  if (connecting === device.handle) return <Spinner size={18} thickness={2} />;
  if (connected === device.handle) return <Icon name="check" size={18} color="success" />;
  return undefined;
}

export function NearbyTvs() {
  const t = useT();
  const { client } = useAuth();
  const { devices, connecting, connected, failed, connect } = useNearbyTvs({ client });

  if (devices.length === 0 && !connected) return null;

  return (
    <section className="mb-8 text-left">
      <h2 className="mb-1 font-display text-[15px] font-bold">{t('handoff.nearbyTitle')}</h2>
      <p className="mb-4 text-[13px] leading-relaxed text-muted">{t('handoff.nearbySub')}</p>

      {connected ? (
        <p className="mb-3 text-[13px] font-medium text-success">
          {t('handoff.connected', { name: connected.name })}
        </p>
      ) : null}
      {failed ? (
        <p className="mb-3 text-[13px] font-medium text-danger">{t('handoff.gone')}</p>
      ) : null}

      <ListRow.Group>
        {devices.map((device) => (
          <ListRow
            key={device.handle}
            size="sm"
            icon="device-tv"
            label={device.name}
            hint={t('handoff.check', { check: device.check })}
            trailing={trailing(device, connecting?.handle ?? null, connected?.handle ?? null)}
            onPress={() => void connect(device)}
          />
        ))}
      </ListRow.Group>

      <Txt style={{ fontSize: 12, marginTop: 18, textAlign: 'center' }} color="textDim">
        {t('handoff.otherWays')}
      </Txt>
    </section>
  );
}
