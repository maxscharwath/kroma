// The JS face of the DNS-SD beacon, shaped as the `LanDiscoveryBridge` that
// `@kroma/core` defines and nothing else.
//
// `requireOptionalNativeModule`, like the server-discovery module beside it: a
// build without the native half (a browser shell, a binary from before this
// existed) gets null rather than a throw, and null IS the capability check. No
// module, no link discovery, and handoff falls back to the server that has been
// carrying it all along.

import type { LanDiscoveryBridge, LanService } from '@kroma/core';
import { type NativeModule, requireOptionalNativeModule } from 'expo';

// Distinct from the server's `_kroma._tcp`: what is advertised here is a
// television waiting for an account, not a server offering a library. Both
// halves hardcode it, because Apple wants the type declared in Info.plist
// before a browse is permitted at all and so it cannot be a runtime argument.
export const SERVICE_TYPE = '_kroma-tv._tcp';

declare class LanBeaconNativeModule extends NativeModule<{
  // Emitted on every change to what is audible, carrying the whole current view
  // rather than a delta: a browser that missed a departure would otherwise show
  // a television that has gone.
  'lan-beacon:found': (event: { services: LanService[] }) => void;
}> {
  publish(name: string, txt: Record<string, string>): void;
  unpublish(): void;
  startBrowse(): void;
  stopBrowse(): void;
}

const native = requireOptionalNativeModule<LanBeaconNativeModule>('LanBeacon');

/**
 * This device's DNS-SD stack, or null on a target without the native half.
 *
 * Pass it to `useNearbyTvs({ lan })` on a telephone and to `startHandoff({
 * publish })` on a television; a shell that has neither passes nothing and
 * every path still works.
 */
export const lanBeacon: LanDiscoveryBridge | null = native
  ? {
      publish(service) {
        native.publish(service.name, service.txt);
        return () => native.unpublish();
      },
      browse(onFound) {
        const subscription = native.addListener('lan-beacon:found', (event) =>
          onFound(event.services),
        );
        native.startBrowse();
        return () => {
          subscription.remove();
          native.stopBrowse();
        };
      },
    }
  : null;
