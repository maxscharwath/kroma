import { describe, expect, it } from 'vitest';
import { moduleIconUrl } from './icon';

describe('moduleIconUrl', () => {
  it('defaults to a same-origin path', () => {
    expect(moduleIconUrl('tv.kroma.vpn')).toBe('/api/modules/tv.kroma.vpn/icon');
  });

  it('prefixes an explicit base origin', () => {
    expect(moduleIconUrl('vpn', 'https://kroma.tv')).toBe('https://kroma.tv/api/modules/vpn/icon');
  });

  it('URL-encodes the module id', () => {
    expect(moduleIconUrl('a b/c')).toBe('/api/modules/a%20b%2Fc/icon');
  });
});
