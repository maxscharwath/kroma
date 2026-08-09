// The phone's half of the nearby handoff, as a hook: the TVs it can find by any
// means, and the one call that signs one of them in.
//
// Web and mobile render this very differently and decide identically, so the
// deciding lives here and each shell brings only its own rows. What differs
// between them is what they can look WITH: a browser has the server and nothing
// else, a phone with the native module also has its own link.

import type { KromaClient } from '@kroma/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiscoveredTv, LanDiscoveryBridge } from '../handoff';
import { lanSource, serverSource, watchNearbyTvs } from '../handoff';

export interface NearbyTvsOptions {
  /** Null stands the watcher down: no session yet, or the screen is not up. */
  client: KromaClient | null;
  /** This device's own DNS-SD stack, when it has one. A phone that can browse
   * finds TVs the server could not place beside it, and grants them with the
   * proof it heard rather than an address the server had to reason about. */
  lan?: LanDiscoveryBridge;
}

export interface NearbyTvs {
  /** Every TV this device could find, merged across the ways it looked and
   * sorted by name. Empty when none are waiting, and empty for a caller the
   * server cannot place beside one either. */
  devices: DiscoveredTv[];
  /** The TV a grant is in flight for, or null. */
  connecting: DiscoveredTv | null;
  /** The TV that was just signed in, or null. Stays put after its row leaves
   * the list, so the confirmation does not vanish with it. */
  connected: DiscoveredTv | null;
  /** True when the last grant was refused, meaning that TV stopped waiting. */
  failed: boolean;
  connect: (device: DiscoveredTv) => Promise<void>;
}

/** Watch for nearby TVs while the picker is open. */
export function useNearbyTvs(opts: NearbyTvsOptions): NearbyTvs {
  const { client, lan } = opts;
  const [devices, setDevices] = useState<DiscoveredTv[]>([]);
  const [connecting, setConnecting] = useState<DiscoveredTv | null>(null);
  const [connected, setConnected] = useState<DiscoveredTv | null>(null);
  const [failed, setFailed] = useState(false);
  // Which install this phone is signed in to. A television heard on the link
  // may belong to a DIFFERENT server (a household with two, a laptop running
  // one), and its handle means nothing to this one: granting it would fail with
  // "no longer waiting" every time. Rows are filtered rather than allowed to
  // fail, because a row that cannot work should not be offered.
  const [ourServer, setOurServer] = useState<string | null>(null);

  useEffect(() => {
    if (!client) {
      setOurServer(null);
      return;
    }
    let cancelled = false;
    client
      .health()
      .then((h) => {
        if (!cancelled) setOurServer(h.instanceId ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client]);

  const sources = useMemo(() => {
    if (!client) return [];
    return lan?.browse ? [serverSource(client), lanSource(lan)] : [serverSource(client)];
  }, [client, lan]);

  useEffect(() => {
    if (sources.length === 0) {
      setDevices([]);
      return;
    }
    return watchNearbyTvs({
      sources,
      // A row heard on the link says which install minted it. Anything from
      // another server is dropped here rather than offered as a tap that can
      // only answer "no longer waiting".
      onRows: (rows) =>
        setDevices(rows.filter((row) => !row.server || !ourServer || row.server === ourServer)),
    });
  }, [sources, ourServer]);

  // A row stays pressable while its grant is in flight, so without this a
  // double tap grants twice: the second either takes a second session or fails,
  // and the picker then shows success and failure at once. Read through a ref
  // rather than state, because two taps can land inside one render.
  const inFlight = useRef(false);

  const connect = useCallback(
    async (device: DiscoveredTv) => {
      if (!client || inFlight.current) return;
      inFlight.current = true;
      setConnected(null);
      setConnecting(device);
      setFailed(false);
      try {
        await client.handoffGrant(device.handle, device.proof);
        setConnected(device);
        // The beacon is consumed server-side; drop the row now rather than
        // leaving a TV in the list that is already signing in.
        setDevices((rows) => rows.filter((row) => row.handle !== device.handle));
      } catch {
        setFailed(true);
      } finally {
        inFlight.current = false;
        setConnecting(null);
      }
    },
    [client],
  );

  return { devices, connecting, connected, failed, connect };
}
