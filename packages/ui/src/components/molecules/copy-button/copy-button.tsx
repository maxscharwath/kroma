import { useEffect, useRef, useState } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '#ui/components/atoms/button';

export interface CopyButtonProps {
  /** What lands on the clipboard. */
  value: string;
  label?: string;
  copiedLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

const RESET_MS = 1400;

/** Copies `value` and confirms it on the control itself, because a toast for
 *  something this small reads as louder than what happened. */
export function CopyButton({
  value,
  label = 'Copier',
  copiedLabel = 'Copié',
  size = 'sm',
  variant = 'outline',
}: Readonly<CopyButtonProps>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Button
      size={size}
      variant={variant}
      icon={copied ? 'check' : 'copy'}
      label={copied ? copiedLabel : label}
      onPress={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), RESET_MS);
        });
      }}
    />
  );
}
