import { defaultConfig } from '../config';
import type { ParsedCommit, ReleaseConfig } from './types';

// Render one changelog entry from a set of commits, sectioned by the config.
// Pure: same commits + version + config always produce the same markdown, so a
// project's CI can assert the changelog is up to date the way a codegen check does.
//
// The shape follows Keep a Changelog / conventional-changelog: an `## version
// (date)` entry heading, `### Section` subheadings, `-` bullets, exactly one
// blank line between blocks and no trailing whitespace.

// Where a new entry goes: above the first existing entry, below whatever header
// or preamble the file already carries.
const FIRST_ENTRY = /^## /m;

function line(commit: ParsedCommit): string {
  const scope = commit.scope ? `**${commit.scope}:** ` : '';
  return `- ${scope}${commit.subject}`;
}

function section(title: string, commits: ParsedCommit[]): string {
  return [`### ${title}`, '', ...commits.map(line)].join('\n');
}

export interface RenderOptions {
  config?: ReleaseConfig;
  // An optional one-sentence human summary (e.g. from a summariser) placed under
  // the heading, above the categorised list. Omitted cleanly when absent.
  summary?: string;
}

export function renderEntry(
  version: string,
  date: string,
  commits: ParsedCommit[],
  options: RenderOptions = {},
): string {
  const config = options.config ?? defaultConfig;
  const summary = options.summary?.trim();
  const blocks = [`## ${version} (${date})`];
  if (summary) blocks.push(summary);
  for (const { title, include } of config.sections) {
    const items = commits.filter(include);
    if (items.length > 0) blocks.push(section(title, items));
  }
  return `${blocks.join('\n\n')}\n`;
}

// Prepend a new entry above the older ones, preserving the file's existing
// header and preamble. `header` is only the fallback for a file that has none
// (a missing or empty changelog, or one that starts straight at an entry).
export function prepend(
  existing: string,
  entry: string,
  header: string = defaultConfig.changelogHeader,
): string {
  const body = existing.trim();
  const at = body.search(FIRST_ENTRY);
  const preamble = (at === -1 ? body : body.slice(0, at)).trim();
  const older = at === -1 ? '' : body.slice(at).trim();
  const blocks = [preamble || header, entry.trim(), older].filter((block) => block.length > 0);
  return `${blocks.join('\n\n')}\n`;
}
