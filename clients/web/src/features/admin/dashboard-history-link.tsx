import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { HistorySearch } from '#web/features/admin/history-query';

export type HistoryLinkFilters = Pick<HistorySearch, 'range' | 'user' | 'item'>;

export function useHistoryLink(): (filters: HistoryLinkFilters) => void {
  const navigate = useNavigate();
  return useCallback(
    (filters: HistoryLinkFilters) => {
      void navigate({ to: '/admin/history', search: filters });
    },
    [navigate],
  );
}
