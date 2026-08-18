import { describe, expect, it } from 'vitest';
import { parseCommits } from '../core/commits';
import { cliSummariser, commitContext } from './summarize';

describe('cliSummariser', () => {
  it('returns the first line of a successful run', () => {
    const s = cliSummariser({
      run: () => ({ status: 0, stdout: 'A crisp human summary.\nignored second line' }),
    });
    expect(s('some diff')).toBe('A crisp human summary.');
  });

  it('falls back to null on a non-zero exit', () => {
    expect(cliSummariser({ run: () => ({ status: 1, stdout: 'nope' }) })('x')).toBeNull();
  });

  it('falls back to null on empty output', () => {
    expect(cliSummariser({ run: () => ({ status: 0, stdout: '   \n' }) })('x')).toBeNull();
  });

  it('falls back to null when the runner throws (CLI absent)', () => {
    const s = cliSummariser({
      run: () => {
        throw new Error('command not found: claude');
      },
    });
    expect(s('x')).toBeNull();
  });

  it('defaults to the claude headless invocation', () => {
    let seen: string[] = [];
    const s = cliSummariser({
      run: (_cmd, args) => {
        seen = args;
        return { status: 0, stdout: 'ok' };
      },
    });
    s('CTX');
    expect(seen[0]).toBe('-p');
    expect(seen[1]).toContain('CTX');
  });
});

describe('commitContext', () => {
  it('renders one line per commit, type and subject only', () => {
    const commits = parseCommits(['feat(tv): a thing', 'fix: another']);
    expect(commitContext(commits)).toBe('- feat: a thing\n- fix: another');
  });

  it('is empty for no commits', () => {
    expect(commitContext([])).toBe('');
  });
});
