import { IconBrandGithub } from '@tabler/icons-react';
import { L } from '#site/components/localized-link';
import { WheelMark } from '#site/components/wheel-mark';
import { localizePath, useLang } from '#site/lib/i18n';
import { useCommon } from '#site/lib/messages/common';
import { site } from '#site/lib/site';

interface FLink {
  label: string;
  /** Canonical internal path (localized on render). */
  to?: string;
  /** External or anchor URL, used as-is. */
  href?: string;
}

function FooterLink({ label, to, href }: FLink) {
  const cls = 'text-sm text-muted transition-colors hover:text-text';
  if (to) {
    return (
      <L to={to} className={cls}>
        {label}
      </L>
    );
  }
  const external = href?.startsWith('http');
  return (
    <a
      href={href}
      className={cls}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      {label}
    </a>
  );
}

export function SiteFooter() {
  const t = useCommon();
  const lang = useLang();
  const home = localizePath('/', lang);
  const l = t.footer.links;

  const columns: { title: string; links: FLink[] }[] = [
    {
      title: t.footer.cols.product,
      links: [
        { label: l.features, href: `${home}#fonctionnalites` },
        { label: l.platforms, href: `${home}#plateformes` },
        { label: l.install, to: '/download' },
        { label: l.tvDemo, href: site.tvUrl },
        { label: l.uiKit, href: site.uiUrl },
        { label: l.modules, href: site.modulesUrl },
      ],
    },
    {
      title: t.footer.cols.resources,
      links: [
        { label: l.blog, to: '/blog' },
        { label: l.source, href: site.repo },
        { label: l.installGuide, href: `${site.repo}/blob/main/INSTALL.md` },
        { label: l.contribute, href: `${site.repo}/blob/main/CONTRIBUTING.md` },
      ],
    },
    {
      title: t.footer.cols.contact,
      links: [
        { label: site.email.support, href: `mailto:${site.email.support}` },
        { label: site.email.privacy, href: `mailto:${site.email.privacy}` },
      ],
    },
    {
      title: t.footer.cols.legal,
      links: [
        { label: l.privacy, to: '/privacy' },
        { label: l.support, to: '/support' },
        { label: l.license, href: `${site.repo}/blob/main/LICENSE` },
      ],
    },
  ];

  return (
    <footer className="border-t border-border/70 bg-surface-1/40">
      <div className="mx-auto max-w-[75rem] py-16" style={{ paddingInline: 'var(--gutter-web)' }}>
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <WheelMark size={26} />
              <span className="font-display text-lg font-extrabold tracking-tight">KROMA</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">{t.footer.blurb}</p>
            <a
              href={site.repo}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <IconBrandGithub size={18} stroke={1.75} aria-hidden />
              {t.footer.star}
            </a>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-dim">
                {col.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink {...link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-8 text-sm text-dim sm:flex-row">
          <p>{t.footer.rights}</p>
          <p>{t.footer.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
