import { createFileRoute } from '@tanstack/react-router';
import { PipelinePage } from '#web/features/admin/pipeline';

export const Route = createFileRoute('/admin/pipeline')({
  component: PipelinePage,
});
