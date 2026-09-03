// Thin TV wrapper: all the logic lives in `@kroma/ui`.

import type { ItemId } from '@kroma/client/media';
import type { KromaClient } from '@kroma/core';
import { useStoryboard as useSharedStoryboard } from '@kroma/ui';

export type { Storyboard, StoryboardTile } from '@kroma/ui';

export function useStoryboard(client: KromaClient, itemId: ItemId) {
  return useSharedStoryboard(client, itemId);
}
