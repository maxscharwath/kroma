// Thin TV wrapper over the shared `useStoryboard` hook: keeps the existing
// `useStoryboard(client, itemId)` call site. All logic (lazy-generation polling,
// fast+slow backoff, visibility re-check, tile math) lives in `@luma/ui`.

import type { LumaClient } from '@luma/core';
import { useStoryboard as useSharedStoryboard } from '@luma/ui';

export type { Storyboard, StoryboardTile } from '@luma/ui';

export function useStoryboard(client: LumaClient, itemId: string) {
  return useSharedStoryboard(client, itemId);
}
