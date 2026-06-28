import { createFileRoute } from '@tanstack/react-router';
import { LibrariesScreen } from '#web/features/admin/libraries';

export const Route = createFileRoute('/admin/libraries')({
  component: LibrariesScreen,
});
