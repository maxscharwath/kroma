import { useT } from '@kroma/ui';
import { createFileRoute } from '@tanstack/react-router';
import { NotificationBench } from '#web/features/admin/notifications-bench';
import { Denied, PageHeader, useCap } from '#web/features/admin/shell';

export const Route = createFileRoute('/admin/notifications')({
  component: NotificationsPage,
});

function NotificationsPage() {
  const t = useT();
  const canManage = useCap('settings.manage');
  if (!canManage) return <Denied />;

  return (
    <>
      <PageHeader title={t('admin.notificationsTitle')} subtitle={t('admin.notificationsSub')} />
      <NotificationBench />
    </>
  );
}
