import { IconBrandGithub, IconMenu2 } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { Button } from '#site/components/button';
import { Logo } from '#site/components/logo';
import { navLinks, site } from '#site/lib/site';

// A nav entry is either an in-page anchor (/#…, a plain <a> so the browser
// scrolls) or a route (a client-side <Link>). One helper picks the element.
function NavItem({
  to,
  label,
  onNavigate,
}: {
  to: string;
  label: string;
  onNavigate?: () => void;
}) {
  const cls =
    'text-sm font-medium text-muted transition-colors hover:text-text focus-visible:text-text';
  if (to.startsWith('/#') || to.startsWith('#')) {
    return (
      <a href={to} className={cls} onClick={onNavigate}>
        {label}
      </a>
    );
  }
  return (
    <Link to={to} className={cls} activeProps={{ className: 'text-text' }} onClick={onNavigate}>
      {label}
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-bg/80 backdrop-blur-xl backdrop-saturate-150">
      <div
        className="mx-auto flex h-16 max-w-[75rem] items-center justify-between gap-6"
        style={{ paddingInline: 'var(--gutter-web)' }}
      >
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <NavItem key={l.to} to={l.to} label={l.label} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={site.repo}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="KROMA sur GitHub"
            className="hidden size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-wash hover:text-text sm:flex"
          >
            <IconBrandGithub size={20} stroke={1.75} />
          </a>
          <div className="hidden sm:block">
            <Button to="/download" size="sm">
              Installer
            </Button>
          </div>

          {/* Mobile: a JS-free disclosure. The checkbox holds open state so the
              menu works even before hydration. */}
          <details className="relative md:hidden">
            <summary
              className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-text transition-colors hover:bg-wash [&::-webkit-details-marker]:hidden"
              aria-label="Menu"
            >
              <IconMenu2 size={20} stroke={1.75} />
            </summary>
            <div className="absolute right-0 top-11 w-56 rounded-2xl border border-border-strong bg-surface-1 p-2 shadow-pop">
              <nav className="flex flex-col">
                {navLinks.map((l) => (
                  <div key={l.to} className="rounded-lg px-3 py-2.5 hover:bg-wash">
                    <NavItem to={l.to} label={l.label} />
                  </div>
                ))}
                <a
                  href={site.repo}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-wash hover:text-text"
                >
                  <IconBrandGithub size={18} stroke={1.75} /> GitHub
                </a>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
