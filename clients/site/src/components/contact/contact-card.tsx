import { IconArrowRight, IconArrowUpRight, type TablerIcon } from '@tabler/icons-react';
import { Link, type LinkProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface ContactCardProps {
  /** The tabler glyph for the channel (rendered, not an element, so the card
   *  controls its size/stroke to stay on the design grid). */
  icon: TablerIcon;
  title: string;
  description: ReactNode;
  /** The affordance line under the description, the address or destination the
   *  reader is about to reach (e.g. `support@kroma.tv`, `github.com/…/issues`). */
  action: string;
  /** Internal router destination. Mutually exclusive with `href`. */
  to?: LinkProps['to'];
  /** External URL or `mailto:` address. */
  href?: string;
}

/** A single support channel as one clickable card: glyph, title, a line of
 *  context, and the destination it resolves to. The whole surface is the link
 *  (one large target, not a card with a small button buried in it), and it
 *  renders as a router <Link> for internal paths or a plain <a> for mailto and
 *  external URLs, so a call site picks a destination, never an element. */
export function ContactCard({ icon, title, description, action, to, href }: ContactCardProps) {
  const Icon = icon;
  // A mailto or in-page anchor is not an external site, so it must not open a new
  // tab; only an http(s) URL does.
  const external = href?.startsWith('http');
  const Arrow = to || external ? IconArrowUpRight : IconArrowRight;

  const card = (
    <>
      <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={22} stroke={1.75} aria-hidden />
      </span>
      <div className="mt-5">
        <h3 className="font-display text-lg font-bold text-text">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
      </div>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
        {action}
        <Arrow
          size={16}
          stroke={2}
          className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </>
  );

  const cls =
    'group flex h-full flex-col rounded-2xl border border-border bg-surface-1 p-6 ' +
    'transition-colors duration-200 hover:border-accent/60 hover:bg-surface-2 ' +
    'focus-visible:outline-none focus-visible:border-accent';

  if (to) {
    return (
      <Link to={to} className={cls}>
        {card}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={cls}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      {card}
    </a>
  );
}
