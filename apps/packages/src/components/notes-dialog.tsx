import { NotesBody } from '#site/components/notes-body';
import { Row } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { Dialog } from '#ui/components/organisms/dialog';

export interface NotesDialogProps {
  title: string;
  notes: string;
  href: string;
  onClose: () => void;
}

export function NotesDialog({ title, notes, href, onClose }: Readonly<NotesDialogProps>) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      width={760}
      footer={
        <Row gap={10} justify="flex-end">
          <Button variant="ghost" size="sm" label="Close" onPress={onClose} />
          <Button
            variant="primary"
            size="sm"
            icon="brand-github"
            href={href}
            label="View on GitHub"
          />
        </Row>
      }
    >
      <NotesBody notes={notes} />
    </Dialog>
  );
}
