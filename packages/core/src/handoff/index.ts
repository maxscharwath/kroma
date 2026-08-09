// Nearby handoff, headless: the television's half, the telephone's half, and
// the port every way of finding a television answers through.

export type { HandoffBeaconView, HandoffLoopOptions } from './beacon';
export { startHandoff } from './beacon';
export type { NearbyWatchOptions } from './nearby';
export { watchNearbyTvs } from './nearby';
export type {
  BeaconRecord,
  DiscoveredTv,
  LanDiscoveryBridge,
  LanService,
  TvDiscoverySource,
} from './sources';
export { beaconTxt, lanSource, parseBeaconTxt, serverSource } from './sources';
