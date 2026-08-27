// The pointer-and-filesystem half of <Dropzone>: the drag listeners, the hidden
// native input that does the actual picking, and the two rules a zone enforces
// before it hands anything back.
//
// A visually hidden `<input type="file">` and not a scripted picker, because it
// is what keyboard and assistive tech already know how to drive: the surface is
// a button that clicks it.

import { type DragEvent, type KeyboardEvent, useCallback, useRef, useState } from 'react';
import { Box } from '#ui/components/atoms/box';
import { Spinner } from '#ui/components/atoms/spinner';
import { color } from '#ui/core';
import {
  DropzoneDescription,
  DropzoneIcon,
  type DropzoneRejection,
  type DropzoneRootProps,
  DropzoneTitle,
} from './dropzone-parts';

const HIDDEN = { display: 'none' } as const;

// Matches one file against an `accept` list the way the native input does: a
// bare extension, a full type, or a `type/*` family.
function accepts(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith('.')) return name.endsWith(rule);
      if (rule.endsWith('/*')) return file.type.startsWith(rule.slice(0, -1));
      return file.type === rule;
    });
}

/** Split what arrived into what the zone takes and what it turns away. */
export function sift(
  files: readonly File[],
  { accept, maxSize, multiple }: Pick<DropzoneRootProps, 'accept' | 'maxSize' | 'multiple'>,
): { taken: File[]; turned: DropzoneRejection[] } {
  const taken: File[] = [];
  const turned: DropzoneRejection[] = [];
  for (const file of files) {
    if (!accepts(file, accept)) {
      turned.push({ file, reason: 'type' });
      continue;
    }
    if (maxSize !== undefined && file.size > maxSize) {
      turned.push({ file, reason: 'size' });
      continue;
    }
    taken.push(file);
  }
  // A single-file zone takes the first and says nothing about the rest: they
  // were not rejected by a rule, they were simply not asked for.
  return { taken: multiple ? taken : taken.slice(0, 1), turned };
}

function Root({
  label,
  accept,
  multiple = false,
  maxSize,
  disabled = false,
  loading = false,
  onDrop,
  onReject,
  children,
}: Readonly<DropzoneRootProps>) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const inert = disabled || loading;

  const take = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const { taken, turned } = sift([...files], { accept, maxSize, multiple });
      if (turned.length > 0) onReject?.(turned);
      if (taken.length > 0) onDrop?.(taken);
    },
    [accept, maxSize, multiple, onDrop, onReject],
  );

  const onDropped = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setOver(false);
    if (!inert) take(e.dataTransfer?.files ?? null);
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (inert || (e.key !== 'Enter' && e.key !== ' ')) return;
    // Space would scroll the dialog under the zone.
    e.preventDefault();
    input.current?.click();
  };

  return (
    <>
      <button
        type="button"
        aria-label={label}
        disabled={inert}
        data-drag-active={over || undefined}
        onClick={() => input.current?.click()}
        onKeyDown={onKey}
        onDragOver={(e) => {
          e.preventDefault();
          if (!inert) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDropped}
        style={{
          ...SURFACE_CSS,
          borderColor: color(over ? 'accent' : 'border'),
          background: over ? color('accentSoft') : 'transparent',
          cursor: inert ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Box center gap={8}>
          {loading ? <Spinner /> : children}
        </Box>
      </button>
      {/* Beside the button, not inside it: nesting one interactive element in
          another is invalid, and this one is what actually opens the picker. */}
      <input
        ref={input}
        type="file"
        // Named and kept OUT of the tab order: the button in front of it is the
        // focus stop, and it is the one that opens this.
        aria-label={label}
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        disabled={inert}
        style={HIDDEN}
        onChange={(e) => {
          take(e.target.files);
          // Cleared so picking the SAME file again still fires a change.
          e.target.value = '';
        }}
      />
    </>
  );
}

// The same surface the native half draws, in the properties a DOM node takes.
const SURFACE_CSS = {
  display: 'flex',
  width: '100%',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderWidth: 1.5,
  borderStyle: 'dashed' as const,
  borderRadius: 16,
  padding: '28px 24px',
  transition: 'border-color 140ms ease, background 140ms ease',
};

/** A surface files are dropped on, or clicked to browse for. See ./dropzone. */
const Dropzone = {
  Root,
  Icon: DropzoneIcon,
  Title: DropzoneTitle,
  Description: DropzoneDescription,
};

export type { DropzoneRejection, DropzoneRootProps } from './dropzone-parts';
export { Dropzone };
