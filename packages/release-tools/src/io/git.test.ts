import { describe, expect, it } from 'vitest';
import { commitsSince, type Exec } from './git';

// Capture the args the reader passes to the exec, type-safely, without poking at
// a mock's internal call tuples.
function capturing(stdout: string): { exec: Exec; args: () => string[] } {
  let seen: string[] = [];
  const exec: Exec = (_cmd, args) => {
    seen = args;
    return stdout;
  };
  return { exec, args: () => seen };
}

describe('commitsSince', () => {
  it('splits the log on the sentinel and trims blanks', () => {
    const { exec } = capturing(
      'feat: a\n\nbody@@RELEASE-TOOLS-COMMIT@@fix: b@@RELEASE-TOOLS-COMMIT@@',
    );
    expect(commitsSince('v1.0.0', [], exec)).toEqual(['feat: a\n\nbody', 'fix: b']);
  });

  it('passes a path filter after --', () => {
    const { exec, args } = capturing('');
    commitsSince('v1.0.0', ['server', 'clients/web'], exec);
    expect(args()).toContain('--');
    expect(args().slice(args().indexOf('--') + 1)).toEqual(['server', 'clients/web']);
  });

  it('omits the -- separator when there are no paths', () => {
    const { exec, args } = capturing('');
    commitsSince('v1.0.0', [], exec);
    expect(args()).not.toContain('--');
  });
});
