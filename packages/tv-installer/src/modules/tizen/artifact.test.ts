import { describe, expect, it } from 'vitest';
import { rankArtifacts } from '../../install/artifact';
import { buildable } from '../../install/build';
import { TIZEN_PACKAGE, TIZEN_SHELL } from './artifact';

const tizenOut = '/kroma/clients/tizen/out';

describe('rankArtifacts', () => {
  it('puts the every-tier Samsung build ahead of the newer per-tier slices', () => {
    const built = [
      { path: `${tizenOut}/KROMA-tizen8-0.1.33.wgt`, mtimeMs: 3_000 },
      { path: `${tizenOut}/KROMA-tizen4to7-0.1.33.wgt`, mtimeMs: 2_000 },
      { path: `${tizenOut}/KROMA-tizen-0.1.33.wgt`, mtimeMs: 1_000 },
    ];

    expect(rankArtifacts(built, TIZEN_PACKAGE.preferred)).toEqual([
      `${tizenOut}/KROMA-tizen-0.1.33.wgt`,
      `${tizenOut}/KROMA-tizen8-0.1.33.wgt`,
      `${tizenOut}/KROMA-tizen4to7-0.1.33.wgt`,
    ]);
  });
});

describe('buildable', () => {
  it('builds the shell whose sources live in this checkout', () => {
    expect(buildable(TIZEN_SHELL)).toBe(true);
  });
});
