import { useEffect, useRef, useState } from 'react';
import { Action } from '#site/components/action';

const RESET_MS = 1400;

/** Confirms on the control itself: a toast for something this small reads as
 *  louder than what happened. */
export function CopyAction({ value }: Readonly<{ value: string }>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Action
      onPress={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), RESET_MS);
        });
      }}
    >
      {copied ? 'Copié' : 'Copier'}
    </Action>
  );
}
