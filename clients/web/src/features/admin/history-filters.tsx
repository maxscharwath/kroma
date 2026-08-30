import type { AdminUser, HistoryLibrary } from '@kroma/core';
import { useT } from '@kroma/ui';
import { Row, Select } from '@kroma/ui/kit';
import {
  EVERY_WINDOW,
  HISTORY_RANGES,
  type HistorySearch,
  isHistoryRange,
} from '#web/features/admin/history-query';

interface HistoryFiltersProps {
  search: HistorySearch;
  libraries: readonly HistoryLibrary[];
  users: readonly AdminUser[];
  onSearchChange: (next: HistorySearch) => void;
}

export function HistoryFilters({
  search,
  libraries,
  users,
  onSearchChange,
}: Readonly<HistoryFiltersProps>) {
  const t = useT();
  const narrow = (patch: Partial<HistorySearch>) =>
    onSearchChange({ ...search, ...patch, page: 1 });
  const pickRange = (value: string) =>
    narrow({ range: value !== EVERY_WINDOW && isHistoryRange(value) ? value : undefined });

  return (
    <Row gap={10} wrap>
      <Select.Root
        label={t('admin.allLibrariesFilter')}
        value={search.library ?? ''}
        onValueChange={(value) => narrow({ library: value || undefined })}
      >
        <Select.Trigger />
        <Select.Item value="" label={t('admin.allLibrariesFilter')} />
        {libraries.map((library) => (
          <Select.Item key={library.id} value={library.id} label={library.name} />
        ))}
      </Select.Root>

      <Select.Root
        label={t('admin.colUser')}
        value={search.user ?? ''}
        onValueChange={(value) => narrow({ user: value || undefined })}
      >
        <Select.Trigger />
        <Select.Item value="" label={t('admin.everyMember')} />
        {users.map((user) => (
          <Select.Item key={user.id} value={user.id} label={user.username} />
        ))}
      </Select.Root>

      <Select.Root
        label={t('admin.colWhen')}
        value={search.range ?? EVERY_WINDOW}
        onValueChange={pickRange}
      >
        <Select.Trigger />
        {HISTORY_RANGES.map((option) => (
          <Select.Item key={option.value} value={option.value} label={t(option.labelKey)} />
        ))}
      </Select.Root>
    </Row>
  );
}
