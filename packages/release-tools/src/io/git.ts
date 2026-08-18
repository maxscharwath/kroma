import { execFileSync } from 'node:child_process';

// The only place this library touches git. Injectable exec so the reader is
// testable and a host project can swap in its own VCS or a canned list.

export type Exec = (cmd: string, args: string[]) => string;

const realExec: Exec = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });

// A sentinel printed after each commit body. Plain ASCII (no control chars),
// specific enough that no real commit body contains it.
const SEP = '@@RELEASE-TOOLS-COMMIT@@';

export function commitsSince(since: string, paths: string[] = [], exec: Exec = realExec): string[] {
  const args = ['log', '--no-merges', `--format=%B${SEP}`, `${since}..HEAD`];
  if (paths.length > 0) args.push('--', ...paths);
  return exec('git', args)
    .split(SEP)
    .map((message) => message.trim())
    .filter((message) => message.length > 0);
}
