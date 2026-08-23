import { describe, expect, it } from 'vitest';
import { rankArtifacts } from './artifact';

describe('rankArtifacts', () => {
  it('answers an empty list when nothing has been built', () => {
    expect(rankArtifacts([])).toEqual([]);
  });
});
