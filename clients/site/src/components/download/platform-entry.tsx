import type { ComponentType, ReactNode } from 'react';
import { useLang } from '#site/lib/i18n';

type IconComponent = ComponentType<{
  size?: number | string;
  stroke?: number;
  className?: string;
  'aria-hidden'?: boolean;
}>;

// Only the beta badge is prose here; the name and artifact extensions are
// language-neutral and passed in by the call site.
const betaLabel = { fr: 'Bêta', en: 'Beta' } as const;

export interface PlatformEntryProps {
  icon: IconComponent;
  /** Device / OS name, e.g. "Samsung (Tizen)". */
  name: string;
  /** Artifact extensions rendered as monospace badges, e.g. ['.wgt']. */
  artifacts?: string[];
  /** Flag store/beta channels (TestFlight, Firebase) so expectations are set. */
  beta?: boolean;
  /** The one-time-setup / heads-up note, typically a <Callout>. */
  setup?: ReactNode;
  /** Representative command(s), typically a <CodeBlock>. Optional (Web needs none). */
  children?: ReactNode;
}

/**
 * One device inside a family. A row, not a card: an icon tile, the name with its
 * artifact badges, then the one-time setup and a representative command stacked
 * beneath. Rows share a hairline divider within the family panel, which reads as
 * an edited list rather than a grid of look-alike tiles.
 */
export function PlatformEntry({
  icon: Icon,
  name,
  artifacts,
  beta,
  setup,
  children,
}: PlatformEntryProps) {
  const lang = useLang();
  return (
    <div className="border-t border-border/60 py-6 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-accent">
          <Icon size={20} stroke={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h4 className="font-display text-base font-bold text-text">{name}</h4>
            {artifacts?.map((ext) => (
              <code
                key={ext}
                className="rounded-md bg-wash px-1.5 py-0.5 font-mono text-xs text-accent"
              >
                {ext}
              </code>
            ))}
            {beta && (
              <span className="rounded-full border border-border-strong px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-dim">
                {betaLabel[lang]}
              </span>
            )}
          </div>
          {setup && <div className="mt-3">{setup}</div>}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}
