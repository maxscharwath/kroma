import type { CSSProperties, ReactNode } from 'react';

/**
 * A button, as a button.
 *
 * Not `@kroma/ui`'s: every focusable kit control imports the TV spatial
 * navigator, a webpack UMD bundle whose CommonJS interop runs
 * `createRequire(import.meta.url)` at module init - undefined in workerd, so
 * the worker throws before it serves anything. A page rendered on the edge uses
 * the platform's own control and the kit's tokens for its looks.
 */
export interface ActionProps {
  onPress?: () => void;
  href?: string;
  tone?: 'primary' | 'outline' | 'ghost';
  children: ReactNode;
}

const BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 34,
  padding: '0 14px',
  borderRadius: 'var(--radius-md)',
  font: 'var(--type-meta)',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  transition: 'background var(--dur-fast) var(--ease-out)',
};

const TONES: Record<NonNullable<ActionProps['tone']>, CSSProperties> = {
  primary: {
    background: 'var(--kroma-accent)',
    color: 'var(--kroma-accent-ink)',
    border: '1px solid transparent',
  },
  outline: {
    background: 'var(--kroma-wash)',
    color: 'var(--kroma-text)',
    border: '1px solid var(--kroma-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--kroma-text-muted)',
    border: '1px solid transparent',
  },
};

export function Action({ onPress, href, tone = 'outline', children }: Readonly<ActionProps>) {
  const style = { ...BASE, ...TONES[tone] };
  if (href) {
    return (
      <a href={href} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onPress} style={style}>
      {children}
    </button>
  );
}
