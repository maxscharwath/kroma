import { IconExternalLink } from '@tabler/icons-react';
import type { ComponentType, ReactNode } from 'react';

type IconComponent = ComponentType<{ size?: number | string; stroke?: number; className?: string }>;

export interface PlatformFamilyProps {
  icon: IconComponent;
  title: string;
  /** One line placing the family (who it is for). */
  intro?: ReactNode;
  /** Deep link to the full walkthrough for these devices (INSTALL.md). */
  docHref?: string;
  /** <PlatformEntry> rows. */
  children: ReactNode;
}

/**
 * A device family (Téléviseurs, Ordinateurs, …) as a magazine spread: the label
 * pinned in the left rail (it trails the reader down its own entries on desktop),
 * the entries collected in a single panel on the right. Reusing this frame across
 * families gives the page rhythm; the varied content inside keeps it from reading
 * as boilerplate.
 */
export function PlatformFamily({
  icon: Icon,
  title,
  intro,
  docHref,
  children,
}: PlatformFamilyProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center gap-2.5">
          <Icon size={22} stroke={1.75} className="text-accent" />
          <h3 className="font-display text-xl font-extrabold text-text">{title}</h3>
        </div>
        {intro && <p className="mt-2 text-sm leading-relaxed text-muted">{intro}</p>}
        {docHref && (
          <a
            href={docHref}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-opacity hover:opacity-80"
          >
            Étapes détaillées
            <IconExternalLink size={14} stroke={1.75} />
          </a>
        )}
      </div>
      <div className="surface-hairline rounded-2xl border border-border bg-surface-1/40 p-6 sm:p-7">
        {children}
      </div>
    </div>
  );
}
