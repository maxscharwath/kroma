// Routed detail modal on the design system's <Dialog>: focus trap, Esc,
// scroll-lock and click-outside come with it. Always open; closing navigates
// back via `onClose`. The title is the accessible name only; the content owns
// the visible header.

import { Dialog } from '@kroma/ui/kit';
import type { ReactNode } from 'react';

export function Sheet({
  title,
  onClose,
  children,
}: Readonly<{
  title: string;
  onClose: () => void;
  children: ReactNode;
}>) {
  return (
    <Dialog open onClose={onClose} title={title} titleHidden width={900} pad={0}>
      {children}
    </Dialog>
  );
}
