import { Link, type LinkProps } from '@tanstack/react-router';
import { localeShort, locales, localizePath, useCanonicalPath, useLang } from '#site/lib/i18n';
import { useCommon } from '#site/lib/messages/common';

// A compact FR | EN segmented control. Each side links to the SAME page in the
// other language: it keeps the reader's canonical path and only swaps the locale
// prefix, so switching language on /download lands on /en/download rather than
// bouncing home.
export function LangSwitcher({ className }: { className?: string }) {
  const active = useLang();
  const path = useCanonicalPath();
  const t = useCommon();

  return (
    // A <nav> rather than a div with role="group": this IS a set of navigation
    // links (each locale is a real URL), so the semantic element carries the
    // labelled grouping for a screen reader without an ARIA role to keep in step.
    <nav
      aria-label={t.lang.label}
      className={[
        'inline-flex items-center rounded-lg border border-border p-0.5 text-xs font-semibold',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {locales.map((l) => {
        const isActive = l === active;
        return (
          <Link
            key={l}
            to={localizePath(path, l) as LinkProps['to']}
            aria-current={isActive ? 'true' : undefined}
            className={[
              'rounded-md px-2 py-1 transition-colors',
              isActive
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-text focus-visible:text-text',
            ].join(' ')}
          >
            {localeShort[l]}
          </Link>
        );
      })}
    </nav>
  );
}
