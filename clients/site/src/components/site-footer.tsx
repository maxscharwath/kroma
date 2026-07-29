import { IconBrandGithub } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { WheelMark } from '#site/components/wheel-mark';
import { site } from '#site/lib/site';

interface Col {
  title: string;
  links: { label: string; to?: string; href?: string }[];
}

const columns: Col[] = [
  {
    title: 'Produit',
    links: [
      { label: 'Fonctionnalités', href: '/#fonctionnalites' },
      { label: 'Plateformes', href: '/#plateformes' },
      { label: 'Installer', to: '/download' },
      { label: 'Démo TV', href: site.tvUrl },
    ],
  },
  {
    title: 'Ressources',
    links: [
      { label: 'Blog', to: '/blog' },
      { label: 'Code source', href: site.repo },
      { label: 'Guide d’installation', href: `${site.repo}/blob/main/INSTALL.md` },
      { label: 'Contribuer', href: `${site.repo}/blob/main/CONTRIBUTING.md` },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: site.email.support, href: `mailto:${site.email.support}` },
      { label: site.email.privacy, href: `mailto:${site.email.privacy}` },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'Confidentialité', to: '/privacy' },
      { label: 'Support', to: '/support' },
      { label: 'Licence MIT', href: `${site.repo}/blob/main/LICENSE` },
    ],
  },
];

function FooterLink({ label, to, href }: { label: string; to?: string; href?: string }) {
  const cls = 'text-sm text-muted transition-colors hover:text-text';
  if (to) {
    return (
      <Link to={to} className={cls}>
        {label}
      </Link>
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
  return (
    <footer className="border-t border-border/70 bg-surface-1/40">
      <div className="mx-auto max-w-[75rem] py-16" style={{ paddingInline: 'var(--gutter-web)' }}>
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <WheelMark size={26} />
              <span className="font-display text-lg font-extrabold tracking-tight">KROMA</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Votre médiathèque, chez vous. Auto-hébergée, privée, sans abonnement — un seul binaire
              Rust, sur tous vos écrans.
            </p>
            <a
              href={site.repo}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <IconBrandGithub size={18} stroke={1.75} />
              Star sur GitHub
            </a>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-dim">
                {col.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink {...l} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-8 text-sm text-dim sm:flex-row">
          <p>© {2026} KROMA — Logiciel libre sous licence MIT.</p>
          <p>Conçu pour être possédé, pas loué.</p>
        </div>
      </div>
    </footer>
  );
}
