// The story registry, for Vite (Tizen, webOS, Android TV's WebView, desktop,
// the browser client, and the test runner).
//
// The Metro half is `registry.ts`; see it for why this is split at all. Both
// discover the same files, so a story is never registered in one and missing in
// the other.

import { orderStories, type Story } from './story';

/** `import.meta.glob` is a Vite compile-time transform, not a runtime API, so it
 * has no types outside `vite/client`. Narrowed here to the one shape used. */
type GlobHost = {
  glob(pattern: string, options: { eager: true }): Record<string, { default: Story }>;
};

const modules = (import.meta as unknown as GlobHost).glob('../**/*.stories.tsx', {
  eager: true,
});

const STORIES: readonly Story[] = orderStories(
  Object.keys(modules)
    .sort()
    .map((key) => (modules[key] as { default: Story }).default),
);

export { STORIES };
