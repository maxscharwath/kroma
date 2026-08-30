// @vitest-environment jsdom

import type { PlayEntry } from '@kroma/core';
import { I18nProvider } from '@kroma/ui';
import { pinDesignWidth } from '@kroma/ui/kit';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_COLUMNS } from '#web/features/admin/history-columns';
import { historySort } from '#web/features/admin/history-query';
import { HistoryTable } from '#web/features/admin/history-table';

const play = (fields: Partial<PlayEntry>): PlayEntry => ({
  id: 'p1',
  username: 'maxime',
  kind: 'movie',
  title: 'Les Affranchis',
  startedAt: 0,
  endedAt: 1_700_000_000,
  watchedMs: 0,
  ...fields,
});

afterEach(() => {
  cleanup();
  pinDesignWidth();
});

const SHOW_IDS = new Map([['Severance', 'sev']]);

async function mount(plays: readonly PlayEntry[], onSortChange = vi.fn()) {
  pinDesignWidth(1200);
  const root = createRootRoute({
    component: () => (
      <I18nProvider locale="en">
        <HistoryTable
          columns={HISTORY_COLUMNS}
          plays={plays}
          showIds={SHOW_IDS}
          sort={historySort({})}
          onSortChange={onSortChange}
          emptyKey="admin.noHistory"
          loaded
        />
      </I18nProvider>
    ),
  });
  const show = createRoute({ getParentRoute: () => root, path: '/shows/$id' });
  const router = createRouter({
    routeTree: root.addChildren([show]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return onSortChange;
}

const firstRow = () => screen.getAllByRole('row')[1] as HTMLElement;

describe('the watch history table', () => {
  it('draws one row per session the log answered with', async () => {
    await mount([play({ id: 'p1' }), play({ id: 'p2' }), play({ id: 'p3' })]);

    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getAllByText('Les Affranchis')).toHaveLength(3);
  });

  it('names the series, the season and the episode in the title of one row', async () => {
    await mount([play({ title: 'Chikhai Bardo', showTitle: 'Severance', season: 2, episode: 7 })]);

    expect(screen.getByText('Severance')).toBeTruthy();
    expect(screen.getByText('S2E7 · Chikhai Bardo')).toBeTruthy();
  });

  it('reads the player under the player and the device it ran on under the platform', async () => {
    await mount([play({ player: 'Chrome', device: 'macOS' })]);

    const cells = within(firstRow()).getAllByRole('cell');

    expect(cells.map((cell) => cell.textContent)).toEqual([
      'maxime',
      'Films',
      'Les Affranchis',
      'Chrome',
      'macOS',
      expect.any(String),
    ]);
  });

  it('says which column is ordering the rows and which way', async () => {
    await mount([play({})]);

    const when = screen.getAllByRole('columnheader')[5] as HTMLElement;

    expect(when.getAttribute('aria-sort')).toBe('descending');
  });

  it('turns the column already ordering it around rather than unordering the rows', async () => {
    const asked = await mount([play({})]);

    fireEvent.click(screen.getByRole('button', { name: /^When/ }));

    expect(asked).toHaveBeenCalledWith([{ column: 'endedAt', direction: 'asc' }], {
      column: 'endedAt',
    });
  });

  it('says the log holds nothing rather than drawing a table with no rows in it', async () => {
    await mount([]);

    expect(screen.getByText('No playback history yet.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('sends a film nowhere, because the log cannot say whether the catalog still holds it', async () => {
    await mount([play({ itemId: 'goodfellas', kind: 'movie' })]);

    expect(within(firstRow()).queryByRole('link')).toBeNull();
  });

  it('opens the series an episode belongs to, which is the page that exists', async () => {
    await mount([
      play({ itemId: 'ep7', kind: 'episode', title: 'Chikhai Bardo', showTitle: 'Severance' }),
    ]);

    const link = within(firstRow()).getByRole('link');

    expect(link.getAttribute('href')).toBe('/shows/sev');
  });

  it('leaves a row whose title has left the catalog with nowhere to send the reader', async () => {
    await mount([
      play({ itemId: 'gone', kind: 'episode', title: 'The Dundies', showTitle: 'The Office' }),
    ]);

    expect(within(firstRow()).queryByRole('link')).toBeNull();
    expect(screen.getByText('The Office')).toBeTruthy();
  });

  it('writes the date and the time of day rather than how long ago it was', async () => {
    await mount([play({})]);

    const when = within(firstRow()).getAllByRole('cell')[5]?.textContent ?? '';

    expect(when).toContain('2023');
    expect(when).not.toMatch(/ago/);
  });
});
