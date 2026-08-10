import { describe, expect, it } from 'vitest';
import { iconPath, iconResponse, withIconUrls } from './icon';

const entry = (id: string, version: string, icon?: string | null) => ({ id, version, icon });

const DATA = 'data:image/svg+xml;base64,PHN2Zy8+';

describe('iconPath', () => {
  it('carries the version, so the answer can be cached forever', () => {
    expect(iconPath('tv.kroma.vpn', '1.2.3')).toBe('/icon/tv.kroma.vpn/1.2.3.svg');
  });

  it('encodes an id or version that would otherwise break the path', () => {
    expect(iconPath('a/b', '1 0')).toBe('/icon/a%2Fb/1%200.svg');
  });

  it('stands in for a missing version rather than emitting an empty segment', () => {
    expect(iconPath('tv.kroma.vpn', '')).toBe('/icon/tv.kroma.vpn/0.svg');
  });
});

describe('withIconUrls', () => {
  it('replaces a data URI with the route that serves it', () => {
    const [out] = withIconUrls([entry('tv.kroma.vpn', '1.0.0', DATA)]);
    expect(out?.icon).toBe('/icon/tv.kroma.vpn/1.0.0.svg');
  });

  it('leaves a real URL and a missing icon alone', () => {
    const out = withIconUrls([
      entry('a', '1', 'https://example.test/a.svg'),
      entry('b', '1', null),
      entry('c', '1'),
    ]);
    expect(out[0]?.icon).toBe('https://example.test/a.svg');
    expect(out[1]?.icon).toBeNull();
    expect(out[2]?.icon).toBeUndefined();
  });

  it('does not mutate the entries it was given', () => {
    const original = entry('tv.kroma.vpn', '1.0.0', DATA);
    withIconUrls([original]);
    expect(original.icon).toBe(DATA);
  });
});

describe('iconResponse', () => {
  it('declines a path that is not an icon, so the request falls through', async () => {
    for (const path of ['/', '/modules.json', '/icon/', '/icon/a.svg', '/icon/a/b/c.svg']) {
      expect(await iconResponse(path, {}, () => {})).toBeNull();
    }
  });
});
