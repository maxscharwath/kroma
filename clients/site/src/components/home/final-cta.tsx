import { Button } from '#site/components/button';
import { Container } from '#site/components/container';
import { WheelMark } from '#site/components/wheel-mark';
import { useLang } from '#site/lib/i18n';
import { site } from '#site/lib/site';

// The close. It echoes the hero's centred mark on purpose, the page opens and
// shuts on the same chromatic wheel, but keeps the copy short and points every
// path at the install. A hairline above sets it apart from the blog band. The
// heading is split so its amber span keeps its place in each language.
const copy = {
  fr: {
    headingPre: 'Reprenez la main sur votre ',
    headingAccent: 'médiathèque',
    headingPost: '.',
    lead: 'Un binaire à lancer, votre matériel, vos fichiers. Aucun abonnement, aucune donnée qui s’échappe.',
    install: 'Installer KROMA',
    code: 'Voir le code',
    legal: '© 2026 · logiciel libre · licence GPL-2.0',
  },
  en: {
    headingPre: 'Take back control of your ',
    headingAccent: 'media library',
    headingPost: '.',
    lead: 'One binary to launch, your hardware, your files. No subscription, no data leaking out.',
    install: 'Install KROMA',
    code: 'View the code',
    legal: '© 2026 · free software · GPL-2.0 license',
  },
} as const;

export function FinalCta() {
  const t = copy[useLang()];

  return (
    <section className="relative overflow-hidden border-t border-border/70">
      <div className="glow-amber pointer-events-none absolute inset-x-0 bottom-0 h-[420px]" />
      <Container>
        <div className="relative flex flex-col items-center py-24 text-center sm:py-32">
          <WheelMark size={56} className="mb-7" />
          <h2 className="max-w-2xl text-balance font-display text-4xl font-extrabold leading-[1.05] text-text sm:text-5xl">
            {t.headingPre}
            <span className="text-gradient-amber">{t.headingAccent}</span>
            {t.headingPost}
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted">{t.lead}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button to="/download" size="lg">
              {t.install}
            </Button>
            <Button href={site.repo} variant="outline" size="lg">
              {t.code}
            </Button>
          </div>
          <p className="mt-8 font-mono text-xs text-dim">{t.legal}</p>
        </div>
      </Container>
    </section>
  );
}
