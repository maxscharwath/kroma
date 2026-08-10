import { useEffect, useRef, useState } from 'react';
import { Button, type ButtonVariant } from '#ui/components/atoms/button';
import { IconButton } from '#ui/components/atoms/icon-button';

const RESET_MS = 1400;

export interface CopyActionProps {
  value: string;
  label?: string;
  variant?: ButtonVariant;
  /** Glyph only, for a control that repeats on every row of a page. `label`
   *  stays the accessible name. */
  iconOnly?: boolean;
}

/** Confirms on the control itself: a toast for something this small reads as
 *  louder than what happened. */
export function CopyAction({
  value,
  label = 'Copy',
  variant = 'primary',
  iconOnly = false,
}: Readonly<CopyActionProps>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), RESET_MS);
    });
  };

  if (iconOnly) {
    return (
      <IconButton
        variant="ghost"
        size={30}
        glyph={16}
        icon={copied ? 'check' : 'copy'}
        label={label}
        onPress={copy}
      />
    );
  }

  return (
    <Button
      variant={variant}
      size="sm"
      icon={copied ? 'check' : 'copy'}
      label={copied ? 'Copied' : label}
      onPress={copy}
    />
  );
}
