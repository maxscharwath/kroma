import { describe, expect, it } from 'vitest';
import { devicectlAdvice, failureText } from './devicectl';

const report = (description: string) => ({
  error: {
    code: 1000,
    domain: 'com.apple.dt.CoreDeviceError',
    userInfo: {
      DeviceName: { string: 'Salon' },
      NSLocalizedDescription: { string: description },
    },
  },
  info: { commandType: 'devicectl.device.install.app', jsonVersion: 3, outcome: 'failed' },
});

describe('failureText', () => {
  it('reads the sentence devicectl wrote into its report', () => {
    const written = report('The specified device was not found. (Name: Salon)');

    expect(failureText(written)).toBe('The specified device was not found. (Name: Salon)');
  });

  it('answers nothing for the report of a command that worked', () => {
    const written = { info: { jsonVersion: 3, outcome: 'success' }, result: {} };

    expect(failureText(written)).toBeNull();
  });

  it('answers nothing when devicectl wrote no report at all', () => {
    expect(failureText(null)).toBeNull();
  });
});

describe('devicectlAdvice', () => {
  it('sends the owner back to Xcode when CoreDevice has forgotten the set', () => {
    const said = 'The specified device was not found. (Name: Salon)';

    expect(devicectlAdvice(said)).toContain('pair it again');
  });

  it('tells the owner to wake a set that stopped answering mid-install', () => {
    const said = 'There was a problem communicating with the device.';

    expect(devicectlAdvice(said)).toContain('wake it');
  });

  it('names the setting to change when the set refuses developer commands', () => {
    const said = 'The operation failed since Developer Mode is disabled on the device.';

    expect(devicectlAdvice(said)).toContain('Developer Mode');
  });

  it('blames the signing profile when the set will not verify the bundle', () => {
    const said = 'Failed to install the app on the device. ApplicationVerificationFailed';

    expect(devicectlAdvice(said)).toContain('signing profile');
  });

  it('says which SDK to build against when a simulator bundle is pushed at a real set', () => {
    const said = 'The bundle at the provided URL was built for AppleTVSimulator.';

    expect(devicectlAdvice(said)).toContain('appletvos');
  });

  it('sends the owner to a newer Xcode when the disk image will not mount', () => {
    const said = 'The developer disk image could not be mounted on this device.';

    expect(devicectlAdvice(said)).toContain('update Xcode');
  });

  it('quotes devicectl when the failure is one it has no advice for', () => {
    const said = 'The operation failed since the device is out of storage.';

    expect(devicectlAdvice(said)).toBe(
      'devicectl failed: The operation failed since the device is out of storage.',
    );
  });
});
