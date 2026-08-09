// The phone's half of the nearby handoff, as a hook: the TVs waiting on this
// network, and the one call that signs one of them in.
//
// Web and mobile render this very differently and decide identically, so the
// deciding lives here and each shell brings only its own rows.

import type { HandoffDevice, KromaClient } from '@kroma/client';
import { useCallback, useEffect, useState } from 'react';
import { watchNearbyTvs } from '../handoff';

export interface NearbyTvs {
  /** Every TV waiting on this network, freshest first poll. Empty off the local
   * network too: the server does not distinguish, so nothing here pretends to. */
  devices: HandoffDevice[];
  /** The TV a grant is in flight for, or null. */
  connecting: HandoffDevice | null;
  /** The TV that was just signed in, or null. Stays put after its row leaves
   * the list, so the confirmation does not vanish with it. */
  connected: HandoffDevice | null;
  /** True when the last grant was refused, meaning that TV stopped waiting. */
  failed: boolean;
  connect: (device: HandoffDevice) => Promise<void>;
}

/** Watch the nearby TVs while the picker is open. Pass `null` for `client` to
 * stand the watcher down (no session yet, or the screen is not showing). */
export function useNearbyTvs(client: KromaClient | null): NearbyTvs {
  const [devices, setDevices] = useState<HandoffDevice[]>([]);
  const [connecting, setConnecting] = useState<HandoffDevice | null>(null);
  const [connected, setConnected] = useState<HandoffDevice | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!client) {
      setDevices([]);
      return;
    }
    return watchNearbyTvs({ client, onRows: setDevices });
  }, [client]);

  const connect = useCallback(
    async (device: HandoffDevice) => {
      if (!client) return;
      setConnecting(device);
      setFailed(false);
      try {
        await client.handoffGrant(device.handle);
        setConnected(device);
        // The beacon is consumed server-side; drop the row now rather than
        // leaving a TV in the list that is already signing in.
        setDevices((rows) => rows.filter((row) => row.handle !== device.handle));
      } catch {
        setFailed(true);
      } finally {
        setConnecting(null);
      }
    },
    [client],
  );

  return { devices, connecting, connected, failed, connect };
}
