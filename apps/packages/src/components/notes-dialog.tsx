import { type CSSProperties, useEffect, useRef } from 'react';
import { Button } from '#ui/components/atoms/button';

export interface NotesDialogProps {
  title: string;
  notes: string;
  href: string;
  onClose: () => void;
}

const BACKDROP: CSSProperties = {
  border: 0,
  padding: 0,
  maxWidth: 720,
  width: 'calc(100vw - 48px)',
  maxHeight: '80vh',
  borderRadius: 'var(--radius-2xl)',
  background: 'var(--kroma-surface-1)',
  color: 'var(--kroma-text)',
  boxShadow: 'var(--shadow-pop)',
};

const HEAD: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '18px 22px',
  borderBottom: '1px solid var(--kroma-border)',
};

const BODY: CSSProperties = {
  padding: '18px 22px',
  margin: 0,
  overflow: 'auto',
  maxHeight: 'calc(80vh - 128px)',
  font: 'var(--type-meta)',
  lineHeight: 1.65,
  color: 'var(--kroma-text-muted)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const FOOT: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '14px 22px',
  borderTop: '1px solid var(--kroma-border)',
};

/** A real `<dialog>`: it brings its own focus trap, Escape handling and inert
 *  backdrop, none of which the kit's overlays can provide in a Worker. */
export function NotesDialog({ title, notes, href, onClose }: Readonly<NotesDialogProps>) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} style={BACKDROP} onClose={onClose} aria-label={`Notes for ${title}`}>
      <div style={HEAD}>
        <strong style={{ font: 'var(--type-title)' }}>{title}</strong>
        <Button size="sm" variant="ghost" label="Close" onPress={() => ref.current?.close()} />
      </div>
      <p style={BODY}>{notes || 'This release has no notes.'}</p>
      <div style={FOOT}>
        <Button
          size="sm"
          variant="outline"
          icon="download"
          label="View on GitHub"
          onPress={() => open(href)}
        />
      </div>
    </dialog>
  );
}
