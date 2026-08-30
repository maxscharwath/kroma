import type { AdminUser, HistoryLibrary } from '@kroma/core';
import { useT } from '@kroma/ui';
import { Row, Select } from '@kroma/ui/kit';
import {
  EVERY_WINDOW,
  HISTORY_RANGES,
  type HistorySearch,
  isHistoryRange,
} from '#web/features/admin/history-query';

const ANY_ID = 'all';

interface IdFilterProps {
  label: string;
  anyLabel: string;
  value: string | undefined;
  options: readonly { id: string; name: string }[];
  onPick: (value: string | undefined) => void;
}

function IdFilter({ label, anyLabel, value, options, onPick }: Readonly<IdFilterProps>) {
  return (
    <Select.Root
      label={label}
      value={value ?? ANY_ID}
      onValueChange={(next) => onPick(next === ANY_ID ? undefined : next)}
    >
      <Select.Trigger />
      <Select.Item value={ANY_ID} label={anyLabel} />
      {options.map((option) => (
        <Select.Item key={option.id} value={option.id} label={option.name} />
      ))}
    </Select.Root>
  );
}

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
      <IdFilter
        label={t('admin.allLibrariesFilter')}
        anyLabel={t('admin.allLibrariesFilter')}
        value={search.library}
        options={libraries}
        onPick={(library) => narrow({ library })}
      />

      <IdFilter
        label={t('admin.colUser')}
        anyLabel={t('admin.everyMember')}
        value={search.user}
        options={users.map((user) => ({ id: user.id, name: user.username }))}
        onPick={(user) => narrow({ user })}
      />

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
