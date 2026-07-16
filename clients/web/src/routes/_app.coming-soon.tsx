import { createFileRoute } from '@tanstack/react-router';
import { ComingSoonPage } from '#web/features/requests/calendar';

export const Route = createFileRoute('/_app/coming-soon')({
  component: ComingSoonPage,
});
