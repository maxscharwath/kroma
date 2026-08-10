import { useMemo, useState } from 'react';
import type { ModuleEntry } from '#site/catalog';

const PAGE_SIZE = 8;

/** Substring match over what the card shows: the name, the reverse-DNS id and
 *  the description. The same rule the server's admin store applies. */
export function matchesQuery(m: ModuleEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [m.name, m.id, m.description ?? ''].some((field) => field.toLowerCase().includes(q));
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  /** 1-based index of the first item shown, or 0 when there is nothing. */
  first: number;
  last: number;
}

/** One page of a list, with the page clamped into range: filtering a list down
 *  must never leave the reader on an empty page. */
export function pageOf<T>(items: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.trunc(page)), pageCount);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    items: slice,
    page: current,
    pageCount,
    first: slice.length === 0 ? 0 : start + 1,
    last: start + slice.length,
  };
}

export interface Browse extends Page<ModuleEntry> {
  query: string;
  search: (next: string) => void;
  goTo: (next: number) => void;
  /** How many modules the query matched, across every page. */
  total: number;
}

/** What the reader is looking at, in words: the whole matched set when it fits
 *  on one page, the visible range when it does not. */
export function sliceLabel(b: Pick<Browse, 'first' | 'last' | 'total'>): string {
  const noun = b.total === 1 ? 'module' : 'modules';
  if (b.first === 1 && b.last === b.total) return `${b.total} ${noun}`;
  return `${b.first}-${b.last} of ${b.total} ${noun}`;
}

/** Query and page state over a loaded catalog. A new query returns to page 1,
 *  and the first render is the unfiltered first page, which is what the server
 *  rendered. */
export function useModuleBrowse(modules: readonly ModuleEntry[]): Browse {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const found = useMemo(() => modules.filter((m) => matchesQuery(m, query)), [modules, query]);
  const slice = pageOf(found, page);
  return {
    ...slice,
    query,
    total: found.length,
    search: (next: string) => {
      setQuery(next);
      setPage(1);
    },
    goTo: (next: number) => setPage(Math.min(Math.max(1, next), slice.pageCount)),
  };
}
