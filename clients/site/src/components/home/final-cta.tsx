import { Button } from '#site/components/button';
import { Container } from '#site/components/container';
import { WheelMark } from '#site/components/wheel-mark';
import { site } from '#site/lib/site';

// The close. It echoes the hero's centred mark on purpose — the page opens and
// shuts on the same chromatic wheel — but keeps the copy short and points every
// path at the install. A hairline above sets it apart from the blog band.
export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border/70">
      <div className="glow-amber pointer-events-none absolute inset-x-0 bottom-0 h-[420px]" />
      <Container>
        <div className="relative flex flex-col items-center py-24 text-center sm:py-32">
          <WheelMark size={56} className="mb-7" />
          <h2 className="max-w-2xl text-balance font-display text-4xl font-extrabold leading-[1.05] text-text sm:text-5xl">
            Reprenez la main sur votre <span className="text-gradient-amber">médiathèque</span>.
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted">
            Un binaire à lancer, votre matériel, vos fichiers. Aucun abonnement, aucune donnée qui
            s’échappe.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button to="/download" size="lg">
              Installer KROMA
            </Button>
            <Button href={site.repo} variant="outline" size="lg">
              Voir le code
            </Button>
          </div>
          <p className="mt-8 font-mono text-xs text-dim">© 2026 · logiciel libre · licence MIT</p>
        </div>
      </Container>
    </section>
  );
}
