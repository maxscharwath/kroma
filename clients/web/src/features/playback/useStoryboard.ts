// Thin web wrapper over the shared `useStoryboard` hook: injects the global
// `lumaClient()` so existing callers keep the `useStoryboard(itemId, opts?)`
// signature. All logic (lazy-generation polling, fast+slow backoff, visibility
// re-check, tile math) lives in `@luma/ui`.

import { useStoryboard as useSharedStoryboard } from '@luma/ui';
import { lumaClient } from '#web/shared/lib/api';

export type { Storyboard, StoryboardTile } from '@luma/ui';

export function useStoryboard(itemId: string, opts?: { generate?: boolean }) {
  return useSharedStoryboard(lumaClient(), itemId, opts);
}
