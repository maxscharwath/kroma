import { describe, expect, it } from 'vitest';
import { parseCommits } from './commits';
import { applyBump, decideBump, LEVELS, nextVersion, parseLevel } from './semver';
import type { ParsedCommit, ReleaseConfig } from './types';

const commits = (msgs: string[]) => parseCommits(msgs);

describe('decideBump', () => {
  it('picks the strongest intent (breaking > feat > fix)', () => {
    expect(decideBump(commits(['fix: a', 'feat: b']))).toBe('minor');
    expect(decideBump(commits(['fix: a', 'feat!: b']))).toBe('major');
    expect(decideBump(commits(['fix: a', 'perf: b']))).toBe('patch');
  });

  it('is null when nothing is release-worthy', () => {
    expect(decideBump(commits(['docs: a', 'chore: b', 'test: c']))).toBeNull();
  });

  it('honours a custom bump map (a project can promote docs to a patch)', () => {
    const config = {
      bumpOf: (c: ParsedCommit) => (c.type === 'docs' ? 'patch' : null),
      sections: [],
      changelogHeader: '# Changelog',
    } satisfies ReleaseConfig;
    expect(decideBump(commits(['docs: a']), config)).toBe('patch');
    expect(decideBump(commits(['feat: a']), config)).toBeNull();
  });
});

describe('applyBump', () => {
  it('bumps each level and resets lower parts', () => {
    expect(applyBump('0.1.38', 'patch')).toBe('0.1.39');
    expect(applyBump('0.1.38', 'minor')).toBe('0.2.0');
    expect(applyBump('0.1.38', 'major')).toBe('1.0.0');
  });

  it('drops a pre-release suffix', () => {
    expect(applyBump('1.2.3-rc1', 'patch')).toBe('1.2.4');
  });

  it('throws on a non-SemVer input', () => {
    expect(() => applyBump('latest', 'patch')).toThrow();
  });
});

describe('parseLevel', () => {
  it('accepts the three levels and rejects anything else', () => {
    for (const level of LEVELS) expect(parseLevel(level)).toBe(level);
    expect(parseLevel('MAJOR')).toBeNull();
    expect(parseLevel('bump')).toBeNull();
    expect(parseLevel('')).toBeNull();
  });
});

describe('nextVersion', () => {
  it('returns null when there is no release', () => {
    expect(nextVersion('0.1.0', commits(['docs: x']))).toBeNull();
  });

  it('returns the bumped version otherwise', () => {
    expect(nextVersion('0.1.0', commits(['feat: x']))).toBe('0.2.0');
  });
});
