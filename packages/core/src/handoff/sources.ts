// Where the list of waiting TVs comes from, and the one shape every way of
// finding them answers in.
//
// There are two levels here on purpose:
//
// - `TvDiscoverySource` is the universal port. Anything that can produce rows
//   implements it: the server broker, a DNS-SD browse, and later a vendor TV
//   stack whose shape is nothing like DNS-SD (Samsung's multiscreen channel,
//   LG's Connect SDK). One list, several ways of filling it.
// - `LanDiscoveryBridge` is the narrower shape the DNS-SD family shares. Apple's
//   `NWListener`/`NWBrowser`, Android's `NsdManager` and Rust's `mdns-sd` all
//   publish a named record with a text dictionary and browse for one, so those
//   three platforms share `lanSource` instead of writing it three times.
//
// Nothing here imports a native module. Each shell hands its own bridge in, the
// way `discoverServer` already takes a `browse` hook.

import type { HandoffDevice, KromaClient } from '@kroma/client';

/** One waiting TV, however it was found. */
export interface DiscoveredTv extends HandoffDevice {
  /** How this row arrived. `lan` was heard on this link; `server` was listed by
   * the server from what it could tell of the two devices' addresses. */
  via: 'lan' | 'server';
  /** Carried only by `lan` rows: evidence this row was heard on the link, which
   * the grant sends on so the server can accept it in place of its own
   * address check. Never displayed. */
  proof?: string;
}

/** One way of finding TVs. */
export interface TvDiscoverySource {
  readonly id: string;
  /** Start reporting this source's whole view on every change. Returns stop. */
  start(onRows: (rows: DiscoveredTv[]) => void): () => void;
}

/** One DNS-SD record, as every stack in that family describes one. */
export interface LanService {
  name: string;
  txt: Record<string, string>;
}

/**
 * What a platform with a real DNS-SD stack provides. Either half may be absent:
 * a television publishes and never browses, a telephone browses and never
 * publishes, and a shell with neither simply passes nothing.
 *
 * The service type is the native side's business, not this one's: Apple wants it
 * declared in `Info.plist` before a browse is allowed at all, so it cannot be a
 * runtime argument.
 */
export interface LanDiscoveryBridge {
  publish?: (service: LanService) => () => void;
  browse?: (onFound: (services: LanService[]) => void) => () => void;
}

/** What a TV puts in its record, and what a phone reads back out. */
export interface BeaconRecord {
  handle: string;
  name: string;
  platform: string;
  check: string;
  proof: string;
}

// Bumped if the keys below ever change meaning, so a newer phone can tell an
// older TV's record from one it should ignore.
const RECORD_VERSION = '1';

/** The text dictionary a TV publishes. Keys are short, as DNS-SD prefers. */
export function beaconTxt(record: BeaconRecord): Record<string, string> {
  return {
    v: RECORD_VERSION,
    handle: record.handle,
    name: record.name,
    platform: record.platform,
    check: record.check,
    proof: record.proof,
  };
}

/** Read a record back, or null if it is not one this build understands. A
 * malformed or future record is skipped rather than shown half-empty. */
export function parseBeaconTxt(txt: Record<string, string>): BeaconRecord | null {
  if (txt.v !== RECORD_VERSION) return null;
  const { handle, name, platform, check, proof } = txt;
  if (!handle || !check || !proof) return null;
  return { handle, name: name || '', platform: platform || '', check, proof };
}

/** The TVs the server can see from the two devices' addresses. Works wherever
 * the server does, which is everywhere, and is the only source a browser has. */
export function serverSource(client: KromaClient, everyMs = 3000): TvDiscoverySource {
  return {
    id: 'server',
    start(onRows) {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const wait = () => {
        if (stopped) return;
        timer = setTimeout(() => void tick(), everyMs);
      };

      const tick = async () => {
        try {
          const rows = await client.handoffDevices();
          if (!stopped) onRows(rows.map((row) => ({ ...row, via: 'server' as const })));
        } catch {
          /* keep the last good list: a dropped poll is not a TV going away */
        }
        wait();
      };

      void tick();
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = undefined;
      };
    },
  };
}

/** The TVs this device can hear on its own link. Stronger evidence of being in
 * the same room than any address comparison: link-local multicast does not
 * cross a router, so a record you heard is a TV you are next to. */
export function lanSource(bridge: LanDiscoveryBridge): TvDiscoverySource {
  return {
    id: 'lan',
    start(onRows) {
      const browse = bridge.browse;
      if (!browse) return () => undefined;
      return browse((services) => {
        const rows: DiscoveredTv[] = [];
        for (const service of services) {
          const record = parseBeaconTxt(service.txt);
          if (!record) continue;
          rows.push({
            handle: record.handle,
            // A record with no name of its own still has the one the network
            // published it under.
            name: record.name || service.name,
            platform: record.platform,
            check: record.check,
            via: 'lan',
            proof: record.proof,
          });
        }
        onRows(rows);
      });
    },
  };
}
