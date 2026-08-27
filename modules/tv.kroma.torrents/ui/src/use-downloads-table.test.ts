// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DownloadQuery, PageView } from './schemas';
import { useDownloadsTable } from './use-downloads-table';

const PAGE: PageView = { page: 3, perPage: 10, total: 42, pageCount: 5 };

function queue(query: DownloadQuery = {}) {
  const asked: DownloadQuery[] = [];
  const { result } = renderHook(() =>
    useDownloadsTable({
      downloads: [],
      page: PAGE,
      query,
      onQueryChange: (next) => asked.push(next),
    }),
  );
  return { asked, result };
}

describe('useDownloadsTable', () => {
  it('opens on the newest grab first, which is what the server does unasked', () => {
    const { result } = queue();

    const added = result.current.headings.find((heading) => heading.id === 'added');

    expect(added?.sorted).toBe('desc');
  });

  it('offers the ledger columns and refuses the two it cannot answer for', () => {
    const { result } = queue();

    const sortable = result.current.headings
      .filter((heading) => heading.onSortPress)
      .map((heading) => heading.id);

    expect(sortable).toEqual(['release', 'progress', 'status', 'added']);
  });

  it('names every heading with a key this module ships a translation for', () => {
    const { result } = queue();

    const labels = result.current.headings.map((heading) => heading.label);

    expect(labels).toEqual([
      'downloads.colRelease',
      'downloads.colProgress',
      'downloads.colSpeed',
      'downloads.colStatus',
      'downloads.colAdded',
      undefined,
    ]);
  });
});
