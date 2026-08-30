import type { MessageKey, PlayEntry } from '@kroma/core';
import type { SortableColumn } from '@kroma/module-sdk';

export type HistorySort = 'username' | 'kind' | 'title' | 'device' | 'player' | 'endedAt';

export interface HistoryColumn extends SortableColumn<PlayEntry, HistorySort> {
  labelKey: MessageKey;
  wide: boolean;
  track: string;
}

/** The wire's `device` is the player and its `player` is the platform. */
export const HISTORY_COLUMNS: readonly HistoryColumn[] = [
  {
    sortKey: 'username',
    labelKey: 'admin.colUser',
    valueField: 'username',
    ascendingFirst: true,
    wide: false,
    track: '1.1fr',
  },
  {
    sortKey: 'kind',
    labelKey: 'admin.colType',
    valueField: 'kind',
    ascendingFirst: true,
    wide: true,
    track: '0.7fr',
  },
  {
    sortKey: 'title',
    labelKey: 'admin.colTitle',
    valueField: 'title',
    ascendingFirst: true,
    wide: false,
    track: '2fr',
  },
  {
    sortKey: 'device',
    labelKey: 'admin.colPlayer',
    valueField: 'device',
    ascendingFirst: true,
    wide: true,
    track: '1.1fr',
  },
  {
    sortKey: 'player',
    labelKey: 'admin.colPlatform',
    valueField: 'player',
    ascendingFirst: true,
    wide: true,
    track: '1fr',
  },
  {
    sortKey: 'endedAt',
    labelKey: 'admin.colWhen',
    valueField: 'endedAt',
    wide: true,
    track: '1fr',
  },
];

export const ITEM_HISTORY_COLUMNS: readonly HistoryColumn[] = HISTORY_COLUMNS.filter(
  (column) => column.sortKey !== 'title',
).map((column) => (column.sortKey === 'endedAt' ? { ...column, wide: false } : column));

export function historyGrid(columns: readonly HistoryColumn[]): string {
  return columns.map((column) => column.track).join(' ');
}

export function isHistorySort(value: unknown): value is HistorySort {
  return HISTORY_COLUMNS.some((column) => column.sortKey === value);
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
