import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DISCOVERY_CANDIDATES,
  discoverServer,
  getLocalIPv4,
  subnetCandidates,
} from './discover';

// A fetch stub driven by a URL -> health-body map. Any URL absent from the map
// resolves as a non-ok response (a dead host).
type Health = { ok?: boolean; status?: string; throws?: boolean };
function fakeFetch(map: Record<string, Health>): typeof globalThis.fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const h = map[url];
    if (!h) return { ok: false, json: async () => ({}) } as Response;
    return {
      ok: h.ok ?? true,
      json: async () => {
        if (h.throws) throw new Error('bad json');
        return { status: h.status ?? 'ok' };
      },
    } as Response;
  }) as unknown as typeof globalThis.fetch;
}

describe('subnetCandidates', () => {
  it('emits every /24 host except the device itself', () => {
    const hosts = subnetCandidates('192.168.1.5');
    expect(hosts).toHaveLength(253); // 254 usable minus self
    expect(hosts).toContain('http://192.168.1.1:4040');
    expect(hosts).toContain('http://192.168.1.254:4040');
    expect(hosts).not.toContain('http://192.168.1.5:4040');
  });

  it('honours a custom port and skips the self address', () => {
    const hosts = subnetCandidates('10.0.0.1', 8080);
    expect(hosts).toHaveLength(253);
    expect(hosts[0]).toBe('http://10.0.0.2:8080'); // .1 is self, so .2 is first
    expect(hosts).not.toContain('http://10.0.0.1:8080');
  });

  it('returns an empty list for a malformed IP', () => {
    expect(subnetCandidates('not-an-ip')).toEqual([]);
    expect(subnetCandidates('192.168.1')).toEqual([]);
  });
});

describe('getLocalIPv4', () => {
  it('resolves null when no platform network API is available (node)', async () => {
    await expect(getLocalIPv4()).resolves.toBeNull();
  });
});

describe('discoverServer', () => {
  it('returns the first live named candidate', async () => {
    const fetch = fakeFetch({ 'http://host:4040/api/health': { status: 'ok' } });
    await expect(
      discoverServer({ candidates: ['http://host:4040'], scanSubnet: false, fetch }),
    ).resolves.toBe('http://host:4040');
  });

  it('strips a trailing slash from the returned origin', async () => {
    const fetch = fakeFetch({ 'http://host:4040/api/health': { status: 'ok' } });
    await expect(
      discoverServer({ candidates: ['http://host:4040/'], scanSubnet: false, fetch }),
    ).resolves.toBe('http://host:4040');
  });

  it('skips a dead candidate and returns the next live one', async () => {
    const fetch = fakeFetch({
      'http://a:4040/api/health': { ok: false },
      'http://b:4040/api/health': { status: 'ok' },
    });
    await expect(
      discoverServer({ candidates: ['http://a:4040', 'http://b:4040'], scanSubnet: false, fetch }),
    ).resolves.toBe('http://b:4040');
  });

  it('treats a non-ok status body as not-a-server', async () => {
    const fetch = fakeFetch({ 'http://host:4040/api/health': { status: 'starting' } });
    await expect(
      discoverServer({ candidates: ['http://host:4040'], scanSubnet: false, fetch }),
    ).resolves.toBeNull();
  });

  it('treats a malformed JSON body as not-a-server', async () => {
    const fetch = fakeFetch({ 'http://host:4040/api/health': { throws: true } });
    await expect(
      discoverServer({ candidates: ['http://host:4040'], scanSubnet: false, fetch }),
    ).resolves.toBeNull();
  });

  it('resolves null when no candidate answers and the subnet scan finds no local IP', async () => {
    const fetch = fakeFetch({});
    // scanSubnet defaults to true, but node has no local-IP API so it is skipped.
    await expect(discoverServer({ candidates: ['http://dead:4040'], fetch })).resolves.toBeNull();
  });

  it('probes the default candidate when none is supplied', async () => {
    const base = DEFAULT_DISCOVERY_CANDIDATES[0];
    const fetch = fakeFetch({ [`${base}/api/health`]: { status: 'ok' } });
    await expect(discoverServer({ scanSubnet: false, fetch })).resolves.toBe(base);
  });

  it('resolves null with no candidates and scanning disabled', async () => {
    const fetch = fakeFetch({});
    await expect(discoverServer({ candidates: [], scanSubnet: false, fetch })).resolves.toBeNull();
  });
});
