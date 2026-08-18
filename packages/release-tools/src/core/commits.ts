import type { ParsedCommit } from './types';

// Parse a Conventional Commit message into the parts a release needs. Generic
// and side-effect free: feed it strings from anywhere (git, a webhook, a test).

// type(scope)!: subject   — scope and the breaking `!` are optional.
const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:[ \t](?<subject>.+)$/;

export function parseCommit(message: string): ParsedCommit | null {
  const header = message.split('\n', 1)[0] ?? '';
  const groups = header.match(HEADER)?.groups;
  if (!groups?.type || !groups.subject) return null;
  const breaking = groups.bang === '!' || /^BREAKING CHANGE:/m.test(message);
  return {
    type: groups.type,
    scope: groups.scope ?? null,
    breaking,
    subject: groups.subject.trim(),
  };
}

// Parse many; silently drop the lines that are not Conventional Commits (merge
// commits, hand-written reverts) rather than guessing at their intent.
export function parseCommits(messages: string[]): ParsedCommit[] {
  return messages.map(parseCommit).filter((commit) => commit !== null);
}
