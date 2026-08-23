import { describe, expect, it } from 'vitest';
import { installFailure, parseAdbState } from './install';

const devices = [
  'List of devices attached',
  '192.168.1.34:5555\tdevice',
  '192.168.1.44:5555\tunauthorized',
  'emulator-5554\toffline',
].join('\n');

const failure = (reason: string) =>
  [
    'Performing Streamed Install',
    `adb: failed to install /out/KROMA.apk: Failure [${reason}]`,
    '',
  ].join('\n');

describe('parseAdbState', () => {
  it('reads the state adb holds the television in', () => {
    expect(parseAdbState(devices, '192.168.1.34:5555')).toBe('device');
  });

  it('reads the state of a set that is still asking to trust this computer', () => {
    expect(parseAdbState(devices, '192.168.1.44:5555')).toBe('unauthorized');
  });

  it('answers nothing for a serial adb does not list', () => {
    expect(parseAdbState(devices, '192.168.1.99:5555')).toBeNull();
  });
});

describe('installFailure', () => {
  it('tells the owner to remove a KROMA that was signed with another key', () => {
    const output = failure('INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package tv.kroma.tv');

    expect(installFailure(output)).toContain('adb uninstall tv.kroma.tv');
  });

  it('tells the owner the set already has a newer build than the package', () => {
    const output = failure('INSTALL_FAILED_VERSION_DOWNGRADE');

    expect(installFailure(output)).toContain('uninstall it first, or install a newer .apk');
  });

  it('quotes what adb said when the failure is one it has no advice for', () => {
    const output = failure('INSTALL_FAILED_INSUFFICIENT_STORAGE');

    expect(installFailure(output)).toBe(
      'adb install failed: Performing Streamed Install / ' +
        'adb: failed to install /out/KROMA.apk: Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]',
    );
  });
});
