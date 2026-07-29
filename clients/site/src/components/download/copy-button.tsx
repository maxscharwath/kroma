import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useState } from 'react';
import { useLang } from '#site/lib/i18n';

// Bilingual labels for the two states. `useLang` reads the locale from the URL,
// which is stable during SSR/prerender, so the correct label ships in the static
// HTML for each language before hydration.
const copy = {
  fr: { copy: 'Copier', copied: 'Copié', aria: 'Copier la commande' },
  en: { copy: 'Copy', copied: 'Copied', aria: 'Copy command' },
} as const;

export interface CopyButtonProps {
  /** The exact text placed on the clipboard, passed verbatim, no trimming. */
  value: string;
}

/**
 * The one interactive island on an otherwise static, prerendered page. It is
 * server-safe by construction: the clipboard API is touched ONLY inside the
 * click handler, which never runs during SSR/prerender, so there is no browser
 * global read at module scope or during render, no `useEffect` guard needed.
 * Before hydration the button is inert markup; that is fine, copy is a bonus
 * over the always-selectable text in the code block.
 */
export function CopyButton({ value }: CopyButtonProps) {
  const t = copy[useLang()];
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Older/embedded browsers (some TV webviews open these pages) expose no
    // clipboard; degrade to a no-op rather than throw.
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? t.copied : t.aria}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-sans text-xs font-medium text-dim transition-colors hover:bg-wash hover:text-text focus-visible:text-text focus-visible:outline-none"
    >
      {copied ? (
        <IconCheck size={14} stroke={2} className="text-accent" aria-hidden />
      ) : (
        <IconCopy size={14} stroke={1.75} aria-hidden />
      )}
      {copied ? t.copied : t.copy}
    </button>
  );
}
