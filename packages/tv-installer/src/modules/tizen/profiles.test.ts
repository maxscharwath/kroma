import { describe, expect, it } from 'vitest';
import { parseProfiles } from './profiles';

const xml = [
  '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
  '<profiles active="LUMA" version="3.1">',
  '<profile name="emulator">',
  '<profileitem ca="" distributor="0" key="/keys/emulator.p12" password="secret" rootca=""/>',
  '</profile>',
  '<profile name="LUMA">',
  '<profileitem ca="" distributor="0" key="/certs/author.p12" password="/certs/author.pwd" rootca=""/>',
  '<profileitem ca="" distributor="1" key="/certs/distributor.p12" password="/certs/dist.pwd" rootca=""/>',
  '<profileitem ca="" distributor="2" key="" password="" rootca=""/>',
  '</profile>',
  '</profiles>',
].join('\n');

describe('parseProfiles', () => {
  it('names the profile the tools sign with', () => {
    expect(parseProfiles(xml).active).toBe('LUMA');
  });

  it('reads every profile in the file, not only the active one', () => {
    expect([...parseProfiles(xml).profiles.keys()]).toEqual(['emulator', 'LUMA']);
  });

  it('keeps the author and distributor keys apart by their slot', () => {
    const items = parseProfiles(xml).profiles.get('LUMA');

    expect(items?.get('0')).toEqual({ key: '/certs/author.p12', password: '/certs/author.pwd' });
    expect(items?.get('1')?.key).toBe('/certs/distributor.p12');
  });

  it('leaves out a slot that names no key', () => {
    expect(parseProfiles(xml).profiles.get('LUMA')?.has('2')).toBe(false);
  });

  it('answers nothing for a file with no profile in it', () => {
    expect(parseProfiles('<profiles active="" version="3.1"></profiles>').profiles.size).toBe(0);
  });
});
