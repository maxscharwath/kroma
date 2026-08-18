// The domain types. Pure data — no git, no filesystem, no project specifics —
// so the whole release decision is portable to any repo that speaks Conventional
// Commits and SemVer.

export interface ParsedCommit {
  type: string;
  scope: string | null;
  breaking: boolean;
  subject: string;
}

export type BumpLevel = 'major' | 'minor' | 'patch';

// One changelog section: a heading and the predicate that selects its commits.
export interface Section {
  title: string;
  include: (commit: ParsedCommit) => boolean;
}

// Everything a project can retune without touching the engine: how a commit maps
// to a bump, how the changelog is sectioned, and the changelog file's header.
export interface ReleaseConfig {
  bumpOf: (commit: ParsedCommit) => BumpLevel | null;
  sections: Section[];
  changelogHeader: string;
}
