import { describe, expect, it } from 'vitest';
import { parseCommit, parseCommits } from './commits';

describe('parseCommit', () => {
  it('parses type, scope and subject', () => {
    expect(parseCommit('fix(tv): route the d-pad into the player')).toEqual({
      type: 'fix',
      scope: 'tv',
      breaking: false,
      subject: 'route the d-pad into the player',
    });
  });

  it('parses a scope-less commit', () => {
    expect(parseCommit('feat: add crash reporting')).toEqual({
      type: 'feat',
      scope: null,
      breaking: false,
      subject: 'add crash reporting',
    });
  });

  it('flags a bang as breaking', () => {
    expect(parseCommit('feat(server)!: drop the legacy API')?.breaking).toBe(true);
  });

  it('flags a BREAKING CHANGE footer as breaking', () => {
    const msg = 'refactor(server): rework sessions\n\nBREAKING CHANGE: tokens are reissued';
    expect(parseCommit(msg)?.breaking).toBe(true);
  });

  it('returns null for a non-conventional header', () => {
    expect(parseCommit('Merge branch main')).toBeNull();
    expect(parseCommit('WIP stuff')).toBeNull();
  });
});

describe('parseCommits', () => {
  it('keeps the conventional ones and drops the rest', () => {
    const parsed = parseCommits(['fix: a', 'not a commit', 'feat: b']);
    expect(parsed.map((c) => c.type)).toEqual(['fix', 'feat']);
  });
});
