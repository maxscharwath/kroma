// The story registry, for Metro (Apple TV, Android TV, iOS, Android).
//
// Stories are discovered, not listed. There is no generated file to keep in
// step: add a `*.stories.tsx` anywhere under `src/` and it is in the workbench.
//
// This needs a bundler primitive, and the two bundlers spell it differently:
// Metro has `require.context`, Vite has `import.meta.glob`. That is exactly what
// the kit's `.web` split mechanism is for, so this file is the Metro half and
// `registry.web.ts` is the Vite half. Neither knows about the other.

import { orderStories, type Story } from './story';

/** Metro's build-time directory require. Declared locally rather than globally:
 * it exists in the bundler, not in the runtime, and nothing else should reach
 * for it by accident. */
declare const require: {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp,
  ): { keys(): string[]; <T>(id: string): T };
};

const context = require.context('..', true, /\.stories\.tsx$/);

const STORIES: readonly Story[] = orderStories(
  // Sorted so the list is stable whatever order the bundler enumerates in; the
  // display order is then decided by `orderStories` alone.
  context
    .keys()
    .sort()
    .map((key) => context<{ default: Story }>(key).default),
);

export { STORIES };
