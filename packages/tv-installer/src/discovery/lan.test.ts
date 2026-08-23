import { describe, expect, it } from 'vitest';
import { compareHosts, prefixOf, subnetHosts } from './lan';

describe('prefixOf', () => {
  it('keeps the first three octets of a dotted-quad address', () => {
    expect(prefixOf('192.168.1.42')).toBe('192.168.1');
  });

  it('answers nothing for an address that is not dotted-quad IPv4', () => {
    expect(prefixOf('fe80::1c2b:4aff:fe6d:1a30')).toBeNull();
    expect(prefixOf('192.168.1')).toBeNull();
    expect(prefixOf('192.168.1.42.7')).toBeNull();
  });

  it('answers nothing for an octet past 255', () => {
    expect(prefixOf('192.168.1.256')).toBeNull();
    expect(prefixOf('999.1.1.1')).toBeNull();
  });
});

describe('subnetHosts', () => {
  it('covers every addressable host of a /24', () => {
    const hosts = subnetHosts('192.168.1');

    expect(hosts).toHaveLength(254);
    expect(hosts[0]).toBe('192.168.1.1');
    expect(hosts.at(-1)).toBe('192.168.1.254');
  });

  it('leaves out the address this machine already holds', () => {
    const hosts = subnetHosts('192.168.1', '192.168.1.42');

    expect(hosts).toHaveLength(253);
    expect(hosts).not.toContain('192.168.1.42');
  });
});

describe('compareHosts', () => {
  it('orders addresses by octet rather than by digit', () => {
    const hosts = ['192.168.1.31', '192.168.1.5', '192.168.1.107'];

    expect([...hosts].sort(compareHosts)).toEqual(['192.168.1.5', '192.168.1.31', '192.168.1.107']);
  });

  it('puts a set named rather than addressed after every address', () => {
    const hosts = ['Salon.coredevice.local', '192.168.1.31'];

    expect([...hosts].sort(compareHosts)).toEqual(['192.168.1.31', 'Salon.coredevice.local']);
  });

  it('orders two named sets against each other by name', () => {
    const hosts = ['Salon.coredevice.local', 'Chambre.coredevice.local'];

    expect([...hosts].sort(compareHosts)).toEqual([
      'Chambre.coredevice.local',
      'Salon.coredevice.local',
    ]);
  });
});
