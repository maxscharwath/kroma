import type { MessageKey, PlayEntry, Show } from '@kroma/core';
import type { TableColumn } from '@kroma/ui/kit';

export type HistorySort = 'username' | 'kind' | 'title' | 'device' | 'player' | 'endedAt';

export interface HistoryColumn extends TableColumn {
  column: HistorySort;
  labelKey: MessageKey;
}

export const HISTORY_COLUMNS: readonly HistoryColumn[] = [
  { column: 'username', labelKey: 'admin.colUser', flex: 1.1 },
  { column: 'kind', labelKey: 'admin.colType', flex: 0.7, from: 'md' },
  { column: 'title', labelKey: 'admin.colTitle', flex: 2 },
  { column: 'player', labelKey: 'admin.colPlayer', flex: 1.1, from: 'md' },
  { column: 'device', labelKey: 'admin.colPlatform', flex: 1, from: 'md' },
  { column: 'endedAt', labelKey: 'admin.colWhen', flex: 1, from: 'md' },
];

export const ITEM_HISTORY_COLUMNS: readonly HistoryColumn[] = HISTORY_COLUMNS.filter(
  (column) => column.column !== 'title',
).map((column) => (column.column === 'endedAt' ? { ...column, from: 'base' as const } : column));

export function isHistorySort(value: unknown): value is HistorySort {
  return HISTORY_COLUMNS.some((column) => column.column === value);
}

export function kindKey(kind: string): MessageKey {
  return kind === 'movie' ? 'admin.kindMovie' : 'admin.kindTv';
}

export interface TitleLines {
  lead: string;
  detail: string | null;
}

export function titleLines(play: PlayEntry): TitleLines {
  if (!play.showTitle) return { lead: play.title, detail: null };
  const number = play.season == null ? null : `S${play.season}E${play.episode ?? '?'}`;
  return { lead: play.showTitle, detail: [number, play.title].filter(Boolean).join(' · ') };
}

/** The show each series title names. A title two shows share resolves to
 *  nothing, because the play log keeps the series name and not its id, and a
 *  guess would open the wrong series. */
export function showIdsByTitle(shows: readonly Show[]): ReadonlyMap<string, string> {
  const byTitle = new Map<string, string>();
  const shared = new Set<string>();
  for (const show of shows) {
    if (byTitle.has(show.title)) shared.add(show.title);
    byTitle.set(show.title, show.id);
  }
  for (const title of shared) byTitle.delete(title);
  return byTitle;
}
