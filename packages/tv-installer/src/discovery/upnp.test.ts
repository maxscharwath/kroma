import { describe, expect, it } from 'vitest';
import { parseDeviceDescription } from './upnp';

const description = `<?xml version="1.0" encoding="utf-8"?>
<root xmlns="urn:schemas-upnp-org:device-1-0" xmlns:dlna="urn:schemas-dlna-org:device-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <device>
    <deviceType>urn:schemas-upnp-org:device:MediaRenderer:1</deviceType>
    <friendlyName xml:lang="fr">[LG] webOS TV OLED55C16LA</friendlyName>
    <manufacturer>LG Electronics</manufacturer>
    <manufacturerURL>http://www.lge.com</manufacturerURL>
    <modelName>
      LG TV
    </modelName>
    <modelNumber>OLED55C16LA</modelNumber>
    <UDN>uuid:8e3cf1a4-7c2f-4b19-9a3d-6f0b1f5f5c11</UDN>
    <dlna:X_DLNADOC>DMR-1.50</dlna:X_DLNADOC>
  </device>
</root>`;

describe('parseDeviceDescription', () => {
  it('reads the names a television publishes about itself', () => {
    expect(parseDeviceDescription(description)).toEqual({
      friendlyName: '[LG] webOS TV OLED55C16LA',
      manufacturer: 'LG Electronics',
      modelName: 'LG TV',
      modelNumber: 'OLED55C16LA',
    });
  });

  it('answers empty names for a description that carries none', () => {
    const bare = '<root><device><UDN>uuid:8e3cf1a4</UDN></device></root>';

    expect(parseDeviceDescription(bare)).toEqual({
      friendlyName: '',
      manufacturer: '',
      modelName: '',
      modelNumber: '',
    });
  });
});
