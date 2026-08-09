// What the cast picker learns from this device's own link, kept out of
// `cast.tsx` so the provider stays a wiring step.
//
// Two things, and only the second changes what the picker can DO:
//
// - a signed-in television heard here is already the server's to describe, so
//   hearing it is worth exactly one thing: refetch the roster NOW rather than
//   wait for the next beat. Commands still travel through the server, which is
//   the only party that knows whose television it is.
// - a signed-OUT television is invisible to the roster by definition, and is
//   the reason a picker can read "no televisions available" with one sitting in
//   the room. Those rows are worth showing, with the one action that helps.

import type { DiscoveredTv, LanDiscoveryBridge } from '@kroma/core';
import { watchLanBeacons } from '@kroma/core';
import { useEffect, useRef, useState } from 'react';

export interface LanCastOptions {
  /** This device's DNS-SD stack, when it has one. Absent everywhere else, and
   * everything below then reports nothing. */
  lan?: LanDiscoveryBridge;
  /** Gates on being signed in, like the roster it accelerates. */
  enabled: boolean;
  /** Called when a signed-in television is heard that the roster has not
   * listed. The provider answers by refetching. */
  onUnknownReceiver: () => void;
  /** Whether the roster already knows a receiver id. Read through a ref, so a
   * roster change does not restart the browse. */
  knowsReceiver: (receiverId: string) => boolean;
}

/** The signed-out televisions in the room, and a nudge to refetch when a
 * signed-in one turns up that the server has not mentioned yet. */
export function useLanCast(opts: LanCastOptions): DiscoveredTv[] {
  const { lan, enabled, onUnknownReceiver, knowsReceiver } = opts;
  const [pairable, setPairable] = useState<DiscoveredTv[]>([]);

  // The browse outlives any particular roster, so what it needs from the
  // provider is read at call time rather than captured in the effect's deps.
  const latest = useRef({ onUnknownReceiver, knowsReceiver });
  latest.current = { onUnknownReceiver, knowsReceiver };

  useEffect(() => {
    if (!enabled || !lan?.browse) {
      setPairable([]);
      return;
    }

    return watchLanBeacons(lan, (beacons) => {
      setPairable(beacons.pairable);
      // One nudge per report, however many strangers it held: the refetch it
      // triggers answers for all of them.
      if (beacons.receivers.some((row) => !latest.current.knowsReceiver(row.receiverId))) {
        latest.current.onUnknownReceiver();
      }
    });
  }, [lan, enabled]);

  return pairable;
}
