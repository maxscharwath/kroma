// @vitest-environment jsdom

import { type AdminUser, UserId } from '@kroma/core';
import { I18nProvider } from '@kroma/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HistoryFilters } from '#web/features/admin/history-filters';
import type { HistorySearch } from '#web/features/admin/history-query';

const LIBRARIES = [
  { id: 'nas-films', name: 'Films' },
  { id: 'nas-series', name: 'Séries' },
];

const USERS: AdminUser[] = [
  {
    id: UserId.of('u1'),
    email: 'max@kroma.tv',
    username: 'maxime',
    permissions: [],
    role: 'Propriétaire',
    createdAt: '2026-01-01',
    online: true,
  },
];

function mount(search: HistorySearch) {
  render(
    <I18nProvider locale="en">
      <HistoryFilters
        search={search}
        libraries={LIBRARIES}
        users={USERS}
        onSearchChange={vi.fn()}
      />
    </I18nProvider>,
  );
}

describe("the watch history's filters", () => {
  it('says it is showing every library before one is picked', () => {
    mount({});

    expect(screen.getByText('All libraries')).toBeTruthy();
  });

  it('says it is showing every member before one is picked', () => {
    mount({});

    expect(screen.getByText('Every member')).toBeTruthy();
  });

  it('names the library the address arrived with', () => {
    mount({ library: 'nas-series' });

    expect(screen.getByText('Séries')).toBeTruthy();
  });

  it('names the account the address arrived with', () => {
    mount({ user: 'u1' });

    expect(screen.getByText('maxime')).toBeTruthy();
  });
});
