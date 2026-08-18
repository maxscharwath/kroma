import { cancel, confirm, intro, isCancel, log, outro, select, spinner } from '@clack/prompts';
import { renderEntry } from '../core/changelog';
import { applyBump, decideBump, LEVELS } from '../core/semver';
import type { BumpLevel, ParsedCommit } from '../core/types';
import { commitContext, type Summariser } from './summarize';

export interface InteractiveInput {
  manifestPath: string;
  current: string;
  commits: ParsedCommit[];
  today: string;
  summarise?: Summariser;
}

export interface InteractiveResult {
  version: string;
  entry: string;
}

// Drive the release interactively with @clack/prompts. Returns the chosen
// version + rendered entry, or null when the user cancels or there is nothing to
// release. All the version math and rendering come from the tested core; this
// module only orchestrates the conversation.
export async function interactiveRelease(
  input: InteractiveInput,
): Promise<InteractiveResult | null> {
  intro(`release · ${input.manifestPath}`);

  if (input.commits.length === 0) {
    log.warn('No conventional commits in range — nothing to release.');
    outro('Done.');
    return null;
  }

  const suggested = decideBump(input.commits) ?? 'patch';
  log.info(
    `${input.commits.length} commit(s) since the last release. Suggested bump: ${suggested}.`,
  );

  const level = (await select({
    message: `Bump ${input.current} how?`,
    initialValue: suggested,
    options: LEVELS.map((value) => ({
      value,
      label: `${value} → ${applyBump(input.current, value)}`,
      hint: value === suggested ? 'suggested by commits' : undefined,
    })),
  })) as BumpLevel | symbol;

  if (isCancel(level)) {
    cancel('Release cancelled.');
    return null;
  }

  const version = applyBump(input.current, level);

  let summary: string | undefined;
  if (input.summarise) {
    const wantSummary = await confirm({
      message: 'Write a one-line human summary with the local AI CLI?',
    });
    if (isCancel(wantSummary)) {
      cancel('Release cancelled.');
      return null;
    }
    if (wantSummary) {
      const spin = spinner();
      spin.start('Asking the local CLI…');
      summary = input.summarise(commitContext(input.commits)) ?? undefined;
      spin.stop(summary ? 'Summary written.' : 'No summary (skipped).');
    }
  }

  const entry = renderEntry(version, input.today, input.commits, { summary });
  log.message(entry);

  const write = await confirm({
    message: `Write ${input.current} → ${version} to ${input.manifestPath}?`,
  });
  if (isCancel(write) || !write) {
    cancel('Nothing written.');
    return null;
  }

  outro(`Ready: ${version}`);
  return { version, entry };
}
