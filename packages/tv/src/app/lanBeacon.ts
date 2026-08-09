// The registered DNS-SD stack, or none.
//
// Same shape as `serverBrowse` beside it, and for the same reason: @kroma/tv is
// shared by shells that have a native module and shells that are a web page in
// a television, so the capability is REGISTERED by whichever shell has one
// rather than imported by the code that wants it.

import type { LanDiscoveryBridge } from '@kroma/core';

let current: LanDiscoveryBridge | null = null;

/** Call once at the app root, before the first render; null is a shell that
 * cannot publish, which pairs through the server alone. */
export function setLanBeacon(bridge: LanDiscoveryBridge | null): void {
  current = bridge;
}

/** The registered stack, or null on a target without one. */
export function lanBeacon(): LanDiscoveryBridge | null {
  return current;
}
