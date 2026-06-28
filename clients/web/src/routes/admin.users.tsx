import { createFileRoute } from '@tanstack/react-router';
import { UsersScreen } from '#web/features/admin/users';

export const Route = createFileRoute('/admin/users')({
  component: UsersScreen,
});
