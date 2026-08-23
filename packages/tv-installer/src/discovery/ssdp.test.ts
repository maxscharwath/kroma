import { describe, expect, it } from 'vitest';
import { parseSsdpReply } from './ssdp';

const reply = (...headers: string[]) => ['HTTP/1.1 200 OK', ...headers, '', ''].join('\r\n');

const webosReply = reply(
  'CACHE-CONTROL: max-age=1800',
  'DATE: Sat, 22 Aug 2026 09:12:44 GMT',
  'EXT:',
  'Location: http://192.168.1.32:1754/',
  'SERVER: WebOS/1.4 UPnP/1.0 Linux/4.19',
  'st: urn:lge-com:service:webos-second-screen:1',
  'USN: uuid:8e3cf1a4-7c2f-4b19-9a3d-6f0b1f5f5c11::urn:lge-com:service:webos-second-screen:1',
);

describe('parseSsdpReply', () => {
  it('reads the description URL, the server and the target out of a webOS reply', () => {
    expect(parseSsdpReply(webosReply, '192.168.1.32')).toEqual({
      host: '192.168.1.32',
      location: 'http://192.168.1.32:1754/',
      server: 'WebOS/1.4 UPnP/1.0 Linux/4.19',
      searchTarget: 'urn:lge-com:service:webos-second-screen:1',
    });
  });

  it('answers nothing for a reply that points at no description', () => {
    const noLocation = reply(
      'CACHE-CONTROL: max-age=1800',
      'EXT:',
      'ST: upnp:rootdevice',
      'USN: uuid:8e3cf1a4-7c2f-4b19-9a3d-6f0b1f5f5c11::upnp:rootdevice',
    );

    expect(parseSsdpReply(noLocation, '192.168.1.32')).toBeNull();
  });
});
