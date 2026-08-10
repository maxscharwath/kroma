import { useState } from 'react';
import { NotesDialog } from '#site/components/notes-dialog';
import type { Release } from '#site/lib/release';
import { Button } from '#ui/components/atoms/button';

export function NotesAction({ release }: Readonly<{ release: Release }>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="ghost" label="Notes" onPress={() => setOpen(true)} />
      {open ? (
        <NotesDialog
          title={release.version}
          notes={release.notes}
          href={release.release}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
