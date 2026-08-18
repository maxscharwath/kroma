import type { BumpLevel, ParsedCommit, ReleaseConfig, Section } from './core/types';

// The conventional defaults (SemVer + the conventional-changelog / release-please
// section names). A project reuses these as-is, or spreads and overrides one
// field — e.g. its own bumpOf.

const BUMP_BY_TYPE: Record<string, BumpLevel> = { feat: 'minor', fix: 'patch', perf: 'patch' };

export function defaultBumpOf(commit: ParsedCommit): BumpLevel | null {
  if (commit.breaking) return 'major';
  return BUMP_BY_TYPE[commit.type] ?? null;
}

// A breaking commit is reported once, in the breaking section, whatever its type.
function plain(type: string): Section['include'] {
  return (commit) => commit.type === type && !commit.breaking;
}

export const defaultSections: Section[] = [
  { title: '⚠ BREAKING CHANGES', include: (commit) => commit.breaking },
  { title: 'Features', include: plain('feat') },
  { title: 'Bug Fixes', include: plain('fix') },
  { title: 'Performance Improvements', include: plain('perf') },
];

export const defaultConfig: ReleaseConfig = {
  bumpOf: defaultBumpOf,
  sections: defaultSections,
  changelogHeader: '# Changelog',
};
