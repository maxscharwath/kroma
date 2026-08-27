import { type SortedColumn, type SortedTable, useSortedTable } from '@kroma/module-sdk';
import type { DownloadQuery, DownloadSort, DownloadView, PageView } from './schemas';

/** The grid every download row aligns on, from `md` up. */
export const DOWNLOAD_COLUMNS = 'minmax(0, 1fr) 200px 132px 128px 112px 48px';

// Live throughput is polled from the engine per request and never stored, so
// there is nothing for the server to ORDER BY.
const COLUMNS: SortedColumn<DownloadView, DownloadSort>[] = [
  { id: 'release', label: 'downloads.colRelease', sortBy: 'title', ascendingFirst: true },
  { id: 'progress', label: 'downloads.colProgress', sortBy: 'progress', wide: true },
  { id: 'speed', label: 'downloads.colSpeed', wide: true },
  {
    id: 'status',
    label: 'downloads.colStatus',
    sortBy: 'status',
    ascendingFirst: true,
    wide: true,
  },
  { id: 'added', label: 'downloads.colAdded', sortBy: 'grabbedAt', wide: true },
  { id: 'actions' },
];

const NEWEST_FIRST = { sort: 'added', dir: 'desc' } as const;

interface DownloadsTableOptions {
  downloads?: DownloadView[];
  page?: PageView;
  query: DownloadQuery;
  onQueryChange: (next: DownloadQuery) => void;
}

export function useDownloadsTable({
  downloads,
  page,
  query,
  onQueryChange,
}: Readonly<DownloadsTableOptions>): SortedTable<DownloadView> {
  return useSortedTable({
    columns: COLUMNS,
    rows: downloads,
    page,
    query,
    onQueryChange,
    defaultOrder: NEWEST_FIRST,
    rowId: (row) => row.id,
  });
}
