import { IconCloudOff, IconLicense, IconLock, IconWorldOff } from '@tabler/icons-react';
import { Button } from '#site/components/button';
import { Container } from '#site/components/container';
import { site } from '#site/lib/site';

// The ownership argument, given the weight of a full-width panel. The four points
// are the promise in plain terms; the terminal shows there is nothing more to it
// than one command. Kept on-palette: the "window controls" are neutral, not the
// decorative traffic lights that would drag a second colour in.
const POINTS = [
  { Icon: IconLicense, title: 'Libre', sub: 'Code ouvert, licence MIT' },
  { Icon: IconLock, title: 'Privé', sub: 'Rien ne quitte votre réseau' },
  { Icon: IconWorldOff, title: 'Sans central', sub: 'Aucun compte, aucun abonnement' },
  { Icon: IconCloudOff, title: 'Hors-ligne', sub: 'La lecture fonctionne sans internet' },
] as const;

export function SelfHostBand() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="surface-hairline relative overflow-hidden rounded-3xl border border-border-strong bg-surface-1 p-8 sm:p-12">
          <div className="glow-amber pointer-events-none absolute inset-x-0 -top-24 h-56" />
          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
                Auto-hébergé
              </p>
              <h2 className="text-balance font-display text-3xl font-extrabold leading-[1.05] text-text sm:text-4xl">
                Conçu pour être <span className="text-gradient-amber">possédé</span>, pas loué.
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted">
                Open source, sous licence MIT. Pas de compte à créer, pas d’abonnement, pas de
                service central qui pourrait fermer. Votre bibliothèque et votre activité ne
                quittent jamais votre réseau.
              </p>

              <dl className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                {POINTS.map(({ Icon, title, sub }) => (
                  <div key={title} className="flex items-start gap-3">
                    <Icon size={20} stroke={1.75} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <dt className="font-display text-sm font-bold text-text">{title}</dt>
                      <dd className="mt-0.5 text-sm text-muted">{sub}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="mt-9">
                <Button href={site.repo} variant="outline">
                  Voir sur GitHub
                </Button>
              </div>
            </div>

            {/* One command, and it is running. A real self-host line, not a mockup. */}
            <div className="overflow-hidden rounded-2xl border border-border bg-bg/80 shadow-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <span className="size-2.5 rounded-full border border-border-strong" aria-hidden />
                <span className="size-2.5 rounded-full border border-border-strong" aria-hidden />
                <span className="size-2.5 rounded-full border border-border-strong" aria-hidden />
                <span className="ml-2 font-mono text-[0.7rem] text-dim">démarrer KROMA</span>
              </div>
              <pre className="overflow-x-auto px-4 py-4 font-mono text-[0.82rem] leading-relaxed text-muted">
                <code>
                  <span className="text-accent">$</span> docker run -d -p 4040:4040 \{'\n'}
                  {'    '}-v /volume1/video:/media \{'\n'}
                  {'    '}-v kroma-data:/data \{'\n'}
                  {'    '}ghcr.io/maxscharwath/kroma
                </code>
              </pre>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
