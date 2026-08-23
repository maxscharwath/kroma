import { describe, expect, it } from 'vitest';
import { parseSdbSerial } from './install';

const devices = [
  'List of devices attached ',
  '192.168.1.31:26101\tdevice\tUE50AU7172',
  '192.168.1.44:26101\toffline\tunknown',
  '192.168.1.45:26101\tdevice\tQE55Q60B',
  'emulator-26101\tdevice\tT-samsung-9.0-x86',
].join('\n');

describe('parseSdbSerial', () => {
  it('reads the serial the bridge gave the television at that address', () => {
    expect(parseSdbSerial(devices, '192.168.1.31')).toBe('192.168.1.31:26101');
  });

  it('finds the set that was asked for further down the list', () => {
    expect(parseSdbSerial(devices, '192.168.1.45')).toBe('192.168.1.45:26101');
  });

  it('answers nothing for a set the bridge sees as offline', () => {
    expect(parseSdbSerial(devices, '192.168.1.44')).toBeNull();
  });

  it('answers nothing for a host the bridge never connected to', () => {
    expect(parseSdbSerial(devices, '192.168.1.99')).toBeNull();
  });
});
