import { describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../kroma-client.fixture';
import { disablePush, enablePush, type PushCapability } from './capability';
import type { SubscribeBody } from './schemas';

const SUBSCRIPTION: SubscribeBody = { transport: 'webpush', endpoint: 'https://push/x' };

const capability = (parts: Partial<PushCapability> = {}): PushCapability => ({
  blocker: async () => null,
  subscribe: async () => SUBSCRIPTION,
  endpoint: async () => SUBSCRIPTION.endpoint,
  unsubscribe: async () => undefined,
  ...parts,
});

describe('turning push on', () => {
  it('registers the device against the key the server minted', async () => {
    const subscribe = vi.fn(async () => SUBSCRIPTION);
    const client = fakeClient({
      notifications: {
        push: { key: async () => ({ publicKey: 'vapid', subscribed: false }), subscribe },
      },
    });

    await enablePush(capability({ subscribe }), client);

    expect(subscribe).toHaveBeenCalledWith({ applicationServerKey: 'vapid' });
  });

  it('names the blocker rather than prompting a device that cannot receive push', async () => {
    const key = vi.fn();
    const client = fakeClient({ notifications: { push: { key } } });

    await expect(enablePush(capability({ blocker: async () => 'denied' }), client)).rejects.toThrow(
      'denied',
    );
    expect(key).not.toHaveBeenCalled();
  });
});

describe('turning push off', () => {
  it('silences the device first, then drops the endpoint server-side', async () => {
    const order: string[] = [];
    const client = fakeClient({
      notifications: {
        push: {
          unsubscribe: async () => {
            order.push('server');
          },
        },
      },
    });

    await disablePush(
      capability({
        unsubscribe: async () => {
          order.push('device');
        },
      }),
      client,
    );

    expect(order).toEqual(['device', 'server']);
  });

  it('tells the server nothing when the device held no subscription', async () => {
    const unsubscribe = vi.fn();
    const client = fakeClient({ notifications: { push: { unsubscribe } } });

    await disablePush(capability({ endpoint: async () => null }), client);

    expect(unsubscribe).not.toHaveBeenCalled();
  });
});
