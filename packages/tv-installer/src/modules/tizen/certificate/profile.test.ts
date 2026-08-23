import { describe, expect, it } from 'vitest';
import { profilesXml } from './profile';

const author = { archive: '/home/max/.kroma/certificates/kroma/author.p12', password: 'kroma-dev' };

describe('profilesXml', () => {
  it('makes the profile it writes the active one', () => {
    expect(profilesXml({ name: 'kroma', author })).toContain('<profiles active="kroma"');
  });

  it('puts the author key in the slot the tools read it from', () => {
    const xml = profilesXml({ name: 'kroma', author });

    expect(xml).toContain(`distributor="0" key="${author.archive}" password="kroma-dev"`);
  });

  it('leaves the distributor slots empty when Samsung issued nothing', () => {
    const xml = profilesXml({ name: 'kroma', author });

    expect(xml).toContain('distributor="1" key="" password=""');
    expect(xml).toContain('distributor="2" key="" password=""');
  });

  it('carries a Samsung distributor certificate when there is one', () => {
    const distributor = {
      archive: '/home/max/SamsungCertificate/LUMA/distributor.p12',
      password: 'x',
    };

    const xml = profilesXml({ name: 'LUMA', author, distributor });

    expect(xml).toContain(`distributor="1" key="${distributor.archive}"`);
  });

  it('escapes what would otherwise close an attribute', () => {
    const xml = profilesXml({ name: 'a"b&c', author });

    expect(xml).toContain('active="a&quot;b&amp;c"');
  });
});
