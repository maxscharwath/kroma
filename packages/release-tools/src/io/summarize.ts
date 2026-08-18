import { spawnSync } from 'node:child_process';
import type { ParsedCommit } from '../core/types';

// A summariser turns a change description into a one-sentence human line, or
// null when it cannot. It is an interface so a host project can plug in any
// backend; the built-in shells to a local CLI agent, never an HTTP API.

export type Summariser = (context: string) => string | null;

export interface CliSummariserOptions {
  // The CLI to invoke and how to pass the prompt. Defaults to Claude Code's
  // headless print mode (`claude -p <prompt>`), which runs on the machine's
  // existing login — no API key handled here.
  command?: string;
  buildArgs?: (prompt: string) => string[];
  timeoutMs?: number;
  // Injected for tests.
  run?: (
    command: string,
    args: string[],
    timeoutMs: number,
  ) => { status: number | null; stdout: string };
}

const PROMPT =
  'Summarise the following change in ONE plain sentence for a user-facing ' +
  'changelog. State what changed and why it matters. No preamble, no markdown.\n\n';

function realRun(command: string, args: string[], timeoutMs: number) {
  const res = spawnSync(command, args, { encoding: 'utf8', timeout: timeoutMs });
  return { status: res.status, stdout: res.stdout ?? '' };
}

// Build a Summariser backed by a local CLI agent. Best-effort: absent CLI,
// non-zero exit, timeout or empty output all yield null so the changelog still
// renders from the raw commits. Never on a CI critical path by design.
export function cliSummariser(options: CliSummariserOptions = {}): Summariser {
  const command = options.command ?? 'claude';
  const buildArgs = options.buildArgs ?? ((prompt: string) => ['-p', prompt]);
  const timeoutMs = options.timeoutMs ?? 60_000;
  const run = options.run ?? realRun;
  return (context: string) => {
    try {
      const { status, stdout } = run(command, buildArgs(PROMPT + context), timeoutMs);
      if (status !== 0) return null;
      const first = (stdout.trim().split('\n')[0] ?? '').trim();
      return first.length > 0 ? first : null;
    } catch {
      return null;
    }
  };
}

// The change description handed to a Summariser. Shared so every caller (CLI,
// TUI, a host project) summarises from the same shape of input.
export function commitContext(commits: ParsedCommit[]): string {
  return commits.map((commit) => `- ${commit.type}: ${commit.subject}`).join('\n');
}
