import { describe, expect, it } from 'vitest';
import {
  PUSH_MODE,
  parseSyncMessage,
  SYNC_HEADER_BYTES,
  sendRequest,
  syncPayload,
  syncRequest,
} from './sync';

describe('a sync request', () => {
  it('is four ascii letters and a little-endian length', () => {
    const request = syncRequest('DONE', 1_700_000_000);

    expect(request.length).toBe(SYNC_HEADER_BYTES);
    expect(request.subarray(0, 4).toString('ascii')).toBe('DONE');
    expect(request.readUInt32LE(4)).toBe(1_700_000_000);
  });

  it('puts the payload length in the header when it carries one', () => {
    const payload = syncPayload('DATA', Buffer.alloc(4096));

    expect(payload.readUInt32LE(4)).toBe(4096);
    expect(payload.length).toBe(SYNC_HEADER_BYTES + 4096);
  });

  it('names the file and its mode in one comma-joined field', () => {
    const request = sendRequest('/home/owner/share/tmp/sdk_tools/KROMA.wgt');

    expect(request.subarray(SYNC_HEADER_BYTES).toString('utf8')).toBe(
      `/home/owner/share/tmp/sdk_tools/KROMA.wgt,${PUSH_MODE}`,
    );
  });

  it('sends the mode as the decimal st_mode sdb uses', () => {
    expect(PUSH_MODE).toBe(33261);
  });
});

describe('a sync reply', () => {
  it('reads an acceptance', () => {
    expect(parseSyncMessage(syncRequest('OKAY', 0))).toEqual({ id: 'OKAY', value: 0 });
  });

  it('reads a refusal and the length of its message', () => {
    const reply = syncPayload('FAIL', Buffer.from('no such directory', 'utf8'));

    expect(parseSyncMessage(reply)).toEqual({ id: 'FAIL', value: 17 });
  });

  it('waits for the whole header before deciding anything', () => {
    expect(parseSyncMessage(Buffer.from('OKA', 'ascii'))).toBeNull();
  });
});
