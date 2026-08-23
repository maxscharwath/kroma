import { describe, expect, it } from 'vitest';
import { rankArtifacts } from '../../install/artifact';
import { buildable } from '../../install/build';
import { WEBOS_PACKAGE, WEBOS_SHELL } from './artifact';

const webosOut = '/kroma/clients/webos/out';

describe('rankArtifacts', () => {
  it('sorts a platform that prefers no build newest first', () => {
    const built = [
      { path: `${webosOut}/tv.kroma.webos_0.1.32_all.ipk`, mtimeMs: 1_000 },
      { path: `${webosOut}/tv.kroma.webos_0.1.33_all.ipk`, mtimeMs: 5_000 },
    ];

    expect(rankArtifacts(built, WEBOS_PACKAGE.preferred)).toEqual([
      `${webosOut}/tv.kroma.webos_0.1.33_all.ipk`,
      `${webosOut}/tv.kroma.webos_0.1.32_all.ipk`,
    ]);
  });
});

describe('buildable', () => {
  it('builds the shell whose sources live in this checkout', () => {
    expect(buildable(WEBOS_SHELL)).toBe(true);
  });
});
