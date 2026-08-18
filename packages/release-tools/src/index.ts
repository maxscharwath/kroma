// Public API. Import these in another project to build a release flow around
// your own config, manifests and VCS — the CLI in cli.ts is just one consumer.

export { defaultBumpOf, defaultConfig, defaultSections } from './config';
export type { RenderOptions } from './core/changelog';
export { prepend, renderEntry } from './core/changelog';
export { parseCommit, parseCommits } from './core/commits';
export { applyBump, decideBump, LEVELS, nextVersion, parseLevel } from './core/semver';
export type { BumpLevel, ParsedCommit, ReleaseConfig, Section } from './core/types';
export { commitsSince, type Exec } from './io/git';
export {
  type CliSummariserOptions,
  cliSummariser,
  commitContext,
  type Summariser,
} from './io/summarize';
export { type InteractiveInput, type InteractiveResult, interactiveRelease } from './io/tui';
export {
  cargoUpdater,
  jsonUpdater,
  type ManifestUpdater,
  updaterFor,
} from './manifests';
