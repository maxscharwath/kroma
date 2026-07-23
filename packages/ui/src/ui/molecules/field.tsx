// <Field>: a labelled control, with room for help and for errors.
//
// The control itself is whatever you pass: a TextField, a Switch, a row of
// Chips. What the molecule owns is the arrangement the design specifies, and
// the one rule worth enforcing centrally, which is that an error REPLACES the
// hint rather than stacking under it. Two lines of small text under a field is
// how a form starts looking broken.

import type { ReactNode } from 'react';
import { Box, type BoxProps } from '../primitives/box';
import { Txt } from '../primitives/text';

interface FieldProps extends Omit<BoxProps, 'children'> {
  label: string;
  /** What this is for, when the label alone is not enough. */
  hint?: string;
  /** What is wrong. Takes the hint's place and turns it red. */
  error?: string;
  children?: ReactNode;
}

function Field({ label, hint, error, children, ...box }: Readonly<FieldProps>) {
  const note = error ?? hint;
  return (
    <Box gap={8} {...box}>
      <Txt variant="meta" color="textMuted">
        {label}
      </Txt>
      {children}
      {note ? (
        <Txt variant="meta" color={error ? 'danger' : 'textDim'}>
          {note}
        </Txt>
      ) : null}
    </Box>
  );
}

export type { FieldProps };
export { Field };
