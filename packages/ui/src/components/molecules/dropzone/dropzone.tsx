// <Dropzone>: the surface a file is dropped on, or clicked to browse for.
//
// Dragging a file from the desktop is a POINTER-and-filesystem idea, and a
// television has neither, so the native targets render the surface as a plain
// pressable that reports its press and nothing else: a shell that wants to open
// a picker there does it with the platform's own. The half that listens for
// drags, reads the files and enforces `accept` / `maxSize` is in ./dropzone.web.
//
// The parts follow the same shape as every other compound here: the Root owns
// the state and the behaviour, and the faces inside it are named rather than
// configured, so a caller writes what the surface says instead of passing three
// strings through props.

import { Box } from '#ui/components/atoms/box';
import { Focusable } from '#ui/components/atoms/focusable';
import { HAND } from '#ui/lib/cursor';
import {
  DropzoneDescription,
  DropzoneIcon,
  type DropzoneRootProps,
  DropzoneTitle,
} from './dropzone-parts';

// Dashed rather than filled: it reads as "a thing goes here" instead of as a
// control that does something when pressed.
const SURFACE = {
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1.5,
  borderStyle: 'dashed',
  borderRadius: 16,
  paddingHorizontal: 24,
  paddingVertical: 28,
} as const;

function Root({ label, disabled = false, children }: Readonly<DropzoneRootProps>) {
  return (
    <Focusable role="button" label={label} disabled={disabled} style={[SURFACE, HAND]}>
      <Box center gap={8}>
        {children}
      </Box>
    </Focusable>
  );
}

/**
 * A surface files are dropped on, or clicked to browse for.
 *
 * ```tsx
 * <Dropzone.Root accept=".torrent" maxSize={1024 * 1024} onDrop={([file]) => queue(file)}>
 *   <Dropzone.Icon />
 *   <Dropzone.Title>Drop a .torrent here</Dropzone.Title>
 *   <Dropzone.Description>or click to browse</Dropzone.Description>
 * </Dropzone.Root>
 * ```
 */
const Dropzone = {
  Root,
  Icon: DropzoneIcon,
  Title: DropzoneTitle,
  Description: DropzoneDescription,
};

export type { DropzoneRejection, DropzoneRootProps } from './dropzone-parts';
export { Dropzone };
