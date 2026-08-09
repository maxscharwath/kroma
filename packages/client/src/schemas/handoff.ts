// Runtime schemas for the nearby-handoff domain: signing a TV in by picking it
// out of a list instead of carrying a code across the room. Mirrors the Rust
// `server/src/api/handoff.rs`.

import { z } from 'zod';
import { User } from './accounts';

/** `POST /handoff/announce`: what a TV waiting for an account gets back.
 * `secret` never leaves that TV; `handle` is what a phone grants against;
 * `check` is the four characters the TV prints on its own screen so a person
 * can tell two TVs apart. */
export const HandoffBeacon = z.object({
  handle: z.string(),
  secret: z.string(),
  check: z.string(),
  ttlSecs: z.number(),
  /** How often to poll. Polling is what keeps the beacon listed, so a TV that
   * stops polling leaves the list on its own, with no second heartbeat. */
  pollSecs: z.number(),
});
export type HandoffBeacon = z.infer<typeof HandoffBeacon>;

/** One TV waiting on the caller's own network (`GET /handoff/devices`). Carries
 * no address: which TVs are nearby is the point, where they sit is not. */
export const HandoffDevice = z.object({
  handle: z.string(),
  name: z.string(),
  platform: z.string(),
  check: z.string(),
});
export type HandoffDevice = z.infer<typeof HandoffDevice>;

/** The status-tagged union both pairing polls answer with
 * (`/auth/quickconnect/poll`, `/handoff/poll`). `expired` covers an unknown
 * secret too: a device that cannot tell them apart simply starts over. */
export const PairingStatus = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }),
  z.object({ status: z.literal('expired') }),
  z.object({
    status: z.literal('authorized'),
    token: z.string(),
    accessToken: z.string(),
    user: User,
  }),
]);
export type PairingStatus = z.infer<typeof PairingStatus>;
