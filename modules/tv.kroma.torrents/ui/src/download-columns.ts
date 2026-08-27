import type { SortedColumn } from '@kroma/module-sdk';
import { styles, type TableColumn } from '@kroma/ui/kit';
import type { DownloadSort, DownloadView } from './schemas';

export const COLUMN_GAP = 16;
export const FRAME_INSET = 20;

const TITLE_MIN = 160;

type DownloadColumn = SortedColumn<DownloadView, DownloadSort> & { box: TableColumn };

// Live throughput is polled from the engine per request and never stored, so
// there is nothing for the server to ORDER BY.
export const DOWNLOAD_COLUMNS: readonly DownloadColumn[] = [
  {
    id: 'release',
    label: 'downloads.colRelease',
    sortBy: 'title',
    ascendingFirst: true,
    box: { flex: 1, min: TITLE_MIN + FRAME_INSET },
  },
  {
    id: 'progress',
    label: 'downloads.colProgress',
    sortBy: 'progress',
    box: { width: 200 + COLUMN_GAP, from: 'md' },
  },
  { id: 'speed', label: 'downloads.colSpeed', box: { width: 132 + COLUMN_GAP, from: 'md' } },
  {
    id: 'status',
    label: 'downloads.colStatus',
    sortBy: 'status',
    ascendingFirst: true,
    box: { width: 128 + COLUMN_GAP, from: 'md' },
  },
  {
    id: 'added',
    label: 'downloads.colAdded',
    sortBy: 'grabbedAt',
    box: { width: 112 + COLUMN_GAP, from: 'md' },
  },
  { id: 'actions', box: { width: 48 + COLUMN_GAP + FRAME_INSET } },
];

export const DOWNLOAD_BOXES: readonly TableColumn[] = DOWNLOAD_COLUMNS.map((column) =>
  column.sortBy ? { column: column.id, ...column.box } : column.box,
);

export const CELL = styles({
  start: { grow: 1, justify: 'center', pl: FRAME_INSET },
  inner: { grow: 1, justify: 'center', pl: COLUMN_GAP },
  end: { grow: 1, justify: 'center', pl: COLUMN_GAP, pr: FRAME_INSET },
});
