// Publishes this TV's handoff beacon for as long as it is signed out, and signs
// in the moment a phone on the same network grants it an account.
//
// Mounted above the router, like the cast receiver: the beacon has to be up on
// whichever gate screen the TV happens to be showing, not only on the one that
// mentions it. Renders nothing.
//
// The beacon goes up at the server always, and on this television's own link
// when the shell registered a stack to publish with (see app/lanBeacon).

import { type HandoffBeaconView, type KromaClient, startHandoff } from '@kroma/core';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { lanBeacon } from '#tv/app/lanBeacon';
import { useAuth } from '#tv/app/providers/auth';
import { useConnection } from '#tv/app/providers/connection';
import { useEnv } from '#tv/app/providers/env';
import { deviceId, deviceName } from '#tv/shared/device';

const BeaconCtx = createContext<HandoffBeaconView | null>(null);

/** The beacon this TV is currently waiting under, or null when it is not
 * waiting: signed in, off the local network, or on a server without handoff. */
export function useHandoffBeacon(): HandoffBeaconView | null {
  return useContext(BeaconCtx);
}

export function HandoffBeaconProvider({
  client,
  children,
}: Readonly<{ client: KromaClient | null; children: ReactNode }>) {
  const [beacon, setBeacon] = useState<HandoffBeaconView | null>(null);
  const { user, login } = useAuth();
  const { activeServerUrl } = useConnection();
  const { platform } = useEnv();
  const signedIn = Boolean(user);

  useEffect(() => {
    // Only a signed-out TV waits: once there is an account, the beacon has done
    // its job and would only offer a second one.
    if (!client || !activeServerUrl || signedIn) {
      setBeacon(null);
      return;
    }
    return startHandoff({
      client,
      deviceId: deviceId(),
      name: deviceName(platform),
      platform,
      // Read at start, not at module load: a shell registers its stack at the
      // app root, which has run by the time a gate screen is up.
      publish: lanBeacon()?.publish,
      onBeacon: setBeacon,
      onAuthenticated: (result) => login(result, activeServerUrl),
    });
  }, [client, activeServerUrl, signedIn, platform, login]);

  const value = useMemo(() => beacon, [beacon]);
  return <BeaconCtx.Provider value={value}>{children}</BeaconCtx.Provider>;
}
