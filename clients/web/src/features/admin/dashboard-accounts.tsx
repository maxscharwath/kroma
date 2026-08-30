import type { AdminUser } from '@kroma/core';
import { useT } from '@kroma/ui';
import { EVERYONE, type FilterOption } from '#web/features/admin/dashboard-filters';
import { useCap, usePoll } from '#web/features/admin/shell';
import { useAuth } from '#web/shared/lib/auth';

const POLL_MS = 60000;

/** The authenticated roster, empty for an admin without `users.manage`. The
 *  dashboard itself opens to any admin, so asking regardless would be three
 *  403s a minute rather than a panel that quietly does without the names. */
export function useAccountRoster(): AdminUser[] {
  const { client } = useAuth();
  const allowed = useCap('users.manage');
  const { data } = usePoll(
    ['admin', 'users', allowed],
    () => (allowed ? client.adminUsers() : Promise.resolve(null)),
    POLL_MS,
  );
  return data?.users ?? [];
}

export function useAccountOptions(): FilterOption<string>[] {
  const t = useT();
  const roster = useAccountRoster();
  return [
    { value: EVERYONE, label: t('admin.everyMember') },
    ...roster.map((user) => ({ value: user.id, label: user.username })),
  ];
}
