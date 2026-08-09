// Nearby handoff: a TV with no account announces itself, a phone already signed
// in lists the TVs on its own network and hands one its account.
//
// The TV side (`announceHandoff` / `handoffPoll` / `handoffLeave`) needs no
// session, which is the whole point. The phone side
// (`handoffDevices` / `handoffGrant`) needs one: what it grants is its own
// account. Both sides are refused off the local network, server-side.

import { HandoffBeacon, HandoffDevice, type PairingStatus, validate } from '../schemas';
import { JSON_HEADERS, type RequestContext } from './base';

/** What a TV says about itself when it starts waiting. `deviceId` is its stable
 * per-install id (8-64 of `[A-Za-z0-9._-]`, same shape as a cast receiver id);
 * re-announcing under it replaces the TV's own row instead of adding a second.
 * `prevSecret` retires the beacon being replaced up front. */
export interface HandoffAnnounce {
  deviceId: string;
  name: string;
  platform: string;
  prevSecret?: string;
}

/** Publish this device's beacon → the handle a phone grants against, the secret
 * to poll with, and how often to poll. Public: the announcing device has no
 * account yet. */
export function announceHandoff(
  ctx: RequestContext,
  body: HandoffAnnounce,
): Promise<HandoffBeacon> {
  return ctx
    .json<HandoffBeacon>('/handoff/announce', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    })
    .then((r) => validate(HandoffBeacon, r));
}

/** Take this beacon down early (signed in another way, or quitting) instead of
 * lingering until the TTL. */
export async function handoffLeave(ctx: RequestContext, secret: string): Promise<void> {
  await ctx.json<void>('/handoff/leave', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ secret }),
  });
}

/** Poll this beacon by its secret → `pending` until a phone grants it, then the
 * session exactly once. Polling also keeps the beacon listed, so a TV that stops
 * polling drops off every phone's list on its own. */
export function handoffPoll(ctx: RequestContext, secret: string): Promise<PairingStatus> {
  return ctx.json<PairingStatus>(`/handoff/poll?secret=${encodeURIComponent(secret)}`);
}

/** The TVs waiting on this device's own network. Empty off it:
 * the same answer as "none waiting", which is all a caller may learn. (Bearer.) */
export function handoffDevices(ctx: RequestContext): Promise<HandoffDevice[]> {
  return ctx
    .json<HandoffDevice[]>('/handoff/devices')
    .then((r) => validate(HandoffDevice.array(), r));
}

/** Hand this account to the TV behind `handle`. Pass `proof` when this device
 * heard that TV's record on the link rather than being told about it by the
 * server: it is the stronger evidence of the two, and the only one that holds
 * when the addresses cannot be reconciled. Resolves on 204; throws
 * `KromaApiError` 404 when that TV stopped waiting. (Bearer.) */
export async function handoffGrant(
  ctx: RequestContext,
  handle: string,
  proof?: string,
): Promise<void> {
  await ctx.json<void>('/handoff/grant', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(proof ? { handle, proof } : { handle }),
  });
}
