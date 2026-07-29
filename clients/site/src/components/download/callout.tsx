import type { ComponentType, ReactNode } from 'react';

/** Structural type for a Tabler icon, so a caller passes the component directly
 *  (`icon={IconKey}`) without this file depending on Tabler's exported type. */
type IconComponent = ComponentType<{ size?: number | string; stroke?: number; className?: string }>;

export interface CalloutProps {
  icon: IconComponent;
  /** Short uppercase tag on the first line (e.g. "Réglage unique", "À savoir"). */
  tag?: string;
  children: ReactNode;
}

/**
 * A compact one-time-setup / heads-up note. Every accent stays amber by design
 * law: the tone of the message rides on the *icon* (a key for a setup, a warning
 * triangle for a Gatekeeper/SmartScreen prompt), never on a second colour. Kept
 * inline and quiet so a section reads as prose, not a stack of alert boxes.
 */
export function Callout({ icon: Icon, tag, children }: CalloutProps) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
      <Icon size={16} stroke={1.75} className="mt-0.5 shrink-0 text-accent" />
      <p className="text-sm leading-relaxed text-muted">
        {tag && (
          <span className="mr-1.5 font-sans text-[0.68rem] font-bold uppercase tracking-wider text-accent">
            {tag}
          </span>
        )}
        {children}
      </p>
    </div>
  );
}
