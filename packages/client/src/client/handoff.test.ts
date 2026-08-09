import { describe, expect, it } from 'vitest';
import { HandoffDevice, PairingStatus } from '../schemas/handoff';
import type { RequestContext } from './base';
import {
  announceHandoff,
  handoffDevices,
  handoffGrant,
  handoffLeave,
  handoffPoll,
} from './handoff';

function recordCtx(reply: unknown = {}) {
  const calls: { path: string; init?: RequestInit }[] = [];
  const ctx = {
    baseUrl: 'http://nas',
    json: async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      return reply as never;
    },
  } as unknown as RequestContext;
  return { ctx, calls };
}

const BEACON = {
  handle: 'a1b2c3',
  secret: 's3cr3t',
  check: 'K7QM',
  proof: 'deadbeef',
  ttlSecs: 60,
  pollSecs: 3,
};

describe('announceHandoff', () => {
  it('POSTs what the TV says about itself and validates the reply', async () => {
    const { ctx, calls } = recordCtx(BEACON);
    const beacon = await announceHandoff(ctx, {
      deviceId: 'tv-salon-01',
      name: 'Salon',
      platform: 'tvOS',
    });
    expect(beacon).toEqual(BEACON);
    expect(calls[0]?.path).toBe('/handoff/announce');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({
      deviceId: 'tv-salon-01',
      name: 'Salon',
      platform: 'tvOS',
    });
  });

  it('retires the beacon it replaces in the same call', () => {
    const { ctx, calls } = recordCtx(BEACON);
    void announceHandoff(ctx, {
      deviceId: 'tv-salon-01',
      name: 'Salon',
      platform: 'tvOS',
      prevSecret: 'old',
    });
    expect(JSON.parse(calls[0]?.init?.body as string).prevSecret).toBe('old');
  });

  it('refuses a reply that is not a beacon', async () => {
    const { ctx } = recordCtx({ handle: 'a1b2c3' });
    await expect(
      announceHandoff(ctx, { deviceId: 'tv-salon-01', name: 'Salon', platform: 'tvOS' }),
    ).rejects.toThrow();
  });
});

describe('handoffLeave', () => {
  it('POSTs the secret in the body, never in the path', async () => {
    const { ctx, calls } = recordCtx();
    await handoffLeave(ctx, 's3cr3t');
    expect(calls[0]?.path).toBe('/handoff/leave');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({ secret: 's3cr3t' });
  });
});

describe('handoffPoll', () => {
  it('escapes the secret into the query', () => {
    const { ctx, calls } = recordCtx({ status: 'pending' });
    void handoffPoll(ctx, 'a b&c=d');
    expect(calls[0]?.path).toBe('/handoff/poll?secret=a%20b%26c%3Dd');
  });
});

describe('handoffGrant', () => {
  it('sends the proof when this device heard the TV itself', async () => {
    const { ctx, calls } = recordCtx();
    await handoffGrant(ctx, 'a1b2c3', 'heard-it');
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({
      handle: 'a1b2c3',
      proof: 'heard-it',
    });
  });

  it('omits it when the server is what told this device about the TV', async () => {
    const { ctx, calls } = recordCtx();
    await handoffGrant(ctx, 'a1b2c3');
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({ handle: 'a1b2c3' });
  });
});

describe('handoffDevices / handoffGrant', () => {
  it('lists the waiting TVs and grants one', async () => {
    const row = { handle: 'a1b2c3', name: 'Salon', platform: 'tvOS', check: 'K7QM' };
    const { ctx, calls } = recordCtx([row]);
    const rows = await handoffDevices(ctx);
    expect(rows).toEqual([row]);
    expect(calls[0]?.path).toBe('/handoff/devices');

    await handoffGrant(ctx, 'a1b2c3');
    expect(calls[1]?.path).toBe('/handoff/grant');
    expect(calls[1]?.init?.method).toBe('POST');
    expect(JSON.parse(calls[1]?.init?.body as string)).toEqual({ handle: 'a1b2c3' });
  });

  it('refuses a row that is missing its handle', async () => {
    const { ctx } = recordCtx([{ name: 'Salon', platform: 'tvOS', check: 'K7QM' }]);
    await expect(handoffDevices(ctx)).rejects.toThrow();
  });
});

describe('schemas', () => {
  it('HandoffDevice carries no address', () => {
    const row = HandoffDevice.parse({
      handle: 'a1b2c3',
      name: 'Salon',
      platform: 'tvOS',
      check: 'K7QM',
      ip: '192.168.1.20',
    });
    expect(row).not.toHaveProperty('ip');
  });

  it('PairingStatus discriminates on status', () => {
    expect(PairingStatus.parse({ status: 'pending' }).status).toBe('pending');
    expect(PairingStatus.parse({ status: 'expired' }).status).toBe('expired');

    const authorized = PairingStatus.parse({
      status: 'authorized',
      token: 't',
      accessToken: 'a',
      user: {
        id: 'u1',
        email: 'a@b.c',
        username: 'owner',
        permissions: ['playback'],
        createdAt: 'now',
        hasPin: false,
      },
    });
    expect(authorized.status === 'authorized' && authorized.user.username).toBe('owner');
    // An authorized status with no session is not one.
    expect(() => PairingStatus.parse({ status: 'authorized' })).toThrow();
  });
});
