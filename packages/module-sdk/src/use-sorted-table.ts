// The headings carry the direction read off the QUERY rather than off
// `column.getIsSorted()`. A table instance keeps one identity for its whole
// life, so a heading read through it is a heading the React Compiler caches at
// mount and never recomputes, which is a frozen sort indicator on screen.

import {
  type ColumnDef,
  getCoreRowModel,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type Table as TableInstance,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface TableOrder<Key extends string = string> {
  sort: Key;
  dir: SortDirection;
}

export interface TableQuery<Key extends string = string> {
  page?: number;
  sort?: Key;
  dir?: SortDirection;
}

export interface TablePage {
  page: number;
  perPage: number;
  total: number;
}

export interface SortableColumn<Row, Key extends string = string> {
  /** Sent to the server as the sort key, so it speaks the server's vocabulary
   *  rather than the row's. */
  id: Key;
  /** A translation key. The caller translates it, because a module's catalogue
   *  and the console's are different scopes. */
  label?: string;
  sortBy: keyof Row & string;
  /** First press orders ascending. Defaults to descending, which is what a
   *  number or a date wants and what a name does not. */
  ascendingFirst?: boolean;
  /** Drops out of the table where there is no room for it. */
  wide?: boolean;
}

export interface PlainColumn {
  id: string;
  label?: string;
  sortBy?: undefined;
  wide?: boolean;
}

export type SortedColumn<Row, Key extends string = string> = SortableColumn<Row, Key> | PlainColumn;

/** `onSortPress` is absent when the column cannot be sorted. */
export interface TableHeading {
  id: string;
  label?: string;
  wide?: boolean;
  sorted: SortDirection | false;
  onSortPress?: () => void;
}

export interface SortedTableOptions<Row, Key extends string, Query extends TableQuery<Key>> {
  columns: readonly SortedColumn<Row, Key>[];
  /** The page in hand, or nothing while the first one is in flight. */
  rows?: Row[];
  page?: TablePage;
  query: Query;
  onQueryChange: (next: Query) => void;
  /** Where the server orders when the query names nothing. */
  defaultOrder: TableOrder<Key>;
  rowId?: (row: Row) => string;
}

export interface SortedTable<Row> {
  table: TableInstance<Row>;
  headings: TableHeading[];
}

const NO_ROWS: never[] = [];

function orderIn<Key extends string>(
  query: TableQuery<Key>,
  fallback: TableOrder<Key>,
): TableOrder<Key> {
  return { sort: query.sort ?? fallback.sort, dir: query.dir ?? fallback.dir };
}

function sortingOf(order: TableOrder): SortingState {
  return [{ id: order.sort, desc: order.dir === 'desc' }];
}

function sortable<Row, Key extends string>(
  column: SortedColumn<Row, Key>,
): column is SortableColumn<Row, Key> {
  return column.sortBy !== undefined;
}

function orderOf<Row, Key extends string>(
  sorting: SortingState,
  columns: readonly SortedColumn<Row, Key>[],
  fallback: TableOrder<Key>,
): TableOrder<Key> {
  const first = sorting[0];
  const known = columns.filter(sortable).find((column) => column.id === first?.id);
  if (!first || !known) return fallback;
  return { sort: known.id, dir: first.desc ? 'desc' : 'asc' };
}

function definitionsOf<Row, Key extends string>(
  columns: readonly SortedColumn<Row, Key>[],
): ColumnDef<Row>[] {
  return columns.map((column) => {
    if (!sortable(column)) return { id: column.id, enableSorting: false };
    const field = column.sortBy;
    // A table library offers to sort only a column that has an accessor, so the
    // field that made the column sortable is also what supplies one.
    return {
      id: column.id,
      accessorFn: (row: Row) => row[field],
      sortDescFirst: column.ascendingFirst !== true,
    };
  });
}

/**
 * A table ordered and paged by the server. The query stays authoritative, and a
 * new order asks for page 1 because page 4 of a different order is a different
 * list.
 */
export function useSortedTable<Row, Key extends string, Query extends TableQuery<Key>>({
  columns,
  rows = NO_ROWS,
  page,
  query,
  onQueryChange,
  defaultOrder,
  rowId,
}: Readonly<SortedTableOptions<Row, Key, Query>>): SortedTable<Row> {
  const order = useMemo(() => orderIn(query, defaultOrder), [query, defaultOrder]);
  const sorting = useMemo(() => sortingOf(order), [order]);
  const pagination = useMemo(() => {
    const size = page?.perPage ?? 0;
    // A page count is the row count over the page size, which has no answer at
    // zero, and a table with no answer yet has no page size either.
    return { pageIndex: (page?.page ?? 1) - 1, pageSize: size > 0 ? size : 1 };
  }, [page?.page, page?.perPage]);
  const definitions = useMemo(() => definitionsOf(columns), [columns]);

  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(sortingOf(order)) : updater;
      const asked = orderOf(next, columns, defaultOrder);
      onQueryChange({ ...query, sort: asked.sort, dir: asked.dir, page: 1 });
    },
    [order, columns, defaultOrder, query, onQueryChange],
  );

  const onPaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      onQueryChange({ ...query, page: next.pageIndex + 1 });
    },
    [pagination, query, onQueryChange],
  );

  const table = useReactTable({
    data: rows,
    columns: definitions,
    getRowId: rowId,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    rowCount: page?.total ?? 0,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange,
  });

  const headings = useMemo(
    () =>
      columns.map((column) => ({
        id: column.id,
        label: column.label,
        wide: column.wide,
        sorted: order.sort === column.id ? order.dir : (false as const),
        onSortPress: column.sortBy ? () => table.getColumn(column.id)?.toggleSorting() : undefined,
      })),
    [columns, order, table],
  );

  return { table, headings };
}
