import { createFileRoute } from '@tanstack/react-router';
import { JobsPage } from '#web/features/admin/jobs';

export const Route = createFileRoute('/admin/jobs')({
  component: JobsPage,
});
