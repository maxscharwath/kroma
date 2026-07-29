import { Link, type LinkProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { localizePath, useLang } from '#site/lib/i18n';

export interface LProps {
  /** A canonical (French) path, e.g. `/download`. The active locale decides the
   *  real destination: `/download` for French, `/en/download` for English. */
  to: string;
  className?: string;
  /** Class applied when this link matches the active route. */
  activeClassName?: string;
  children: ReactNode;
  onClick?: () => void;
  'aria-label'?: string;
}

// A router <Link> that prefixes the locale for internal navigation. Call sites
// always write the canonical path; localizePath adds `/en` when English is
// active, so a page never has to know which language it is being rendered in to
// point at the right URL.
export function L({ to, className, activeClassName, children, onClick, ...rest }: LProps) {
  const lang = useLang();
  const dest = localizePath(to, lang) as LinkProps['to'];
  return (
    <Link
      to={dest}
      className={className}
      onClick={onClick}
      activeProps={activeClassName ? { className: activeClassName } : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}
