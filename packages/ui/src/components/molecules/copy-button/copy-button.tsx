import { useEffect, useRef, useState } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '#ui/components/atoms/button';
import { IconButton } from '#ui/components/atoms/icon-button';

export interface CopyButtonProps {
  /** What lands on the clipboard. */
  value: string;
  label?: string;
  copiedLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  /** Glyph only, for a control that repeats on every row of a page. `label`
   *  stays the accessible name. */
  iconOnly?: boolean;
}

const RESET_MS = 1400;

// Smaller than any shell row: this face exists for a control that repeats on
// every row of a list, where a full-height button would out-weigh the row it
// sits in.
const GLYPH_FACE = 30;
const GLYPH = 16;

/** Copies `value` and confirms it on the control itself, because a toast for
 *  something this small reads as louder than what happened. */
export function CopyButton({
  value,
  label = 'Copier',
  copiedLabel = 'Copié',
  size = 'sm',
  variant = 'outline',
  iconOnly = false,
}: Readonly<CopyButtonProps>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // An insecure origin (a self-hosted instance on plain http) and a denied
  // permission both reject: the control simply does not confirm, rather than
  // throwing where nothing is listening.
  const copy = () => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), RESET_MS);
      })
      .catch(() => {});
  };

  if (iconOnly) {
    return (
      <IconButton
        variant="ghost"
        size={GLYPH_FACE}
        glyph={GLYPH}
        icon={copied ? 'check' : 'copy'}
        label={label}
        onPress={copy}
      />
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      icon={copied ? 'check' : 'copy'}
      label={copied ? copiedLabel : label}
      onPress={copy}
    />
  );
}
