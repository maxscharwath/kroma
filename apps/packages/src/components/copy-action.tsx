import { useEffect, useRef, useState } from 'react';
import { Button, type ButtonVariant } from '#ui/components/atoms/button';

const RESET_MS = 1400;

export interface CopyActionProps {
  value: string;
  label?: string;
  variant?: ButtonVariant;
}

/** Confirms on the control itself: a toast for something this small reads as
 *  louder than what happened. */
export function CopyAction({
  value,
  label = 'Copy',
  variant = 'primary',
}: Readonly<CopyActionProps>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Button
      variant={variant}
      size="sm"
      icon={copied ? 'check' : 'copy'}
      label={copied ? 'Copied' : label}
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
