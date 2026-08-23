import { describe, expect, it } from 'vitest';
import type { Television } from '../../television';
import { resolveAndroidArtifact } from './artifact';

const shield: Television = {
  host: '192.168.1.36',
  platform: 'androidtv',
  vendor: 'Nvidia',
  name: 'Shield',
  model: 'SHIELD Android TV',
  developerMode: 'on',
  sideloadable: true,
  note: 'network debugging open on 5555',
  runtime: null,
};

describe('resolveAndroidArtifact', () => {
  it('leaves the Android TV package to the release workflow', async () => {
    const request = { tv: shield, source: 'build', log: () => {} } as const;

    await expect(resolveAndroidArtifact(request)).rejects.toThrow(/release workflow/);
  });
});
