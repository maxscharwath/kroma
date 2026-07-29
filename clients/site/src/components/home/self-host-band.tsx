import { IconCloudOff, IconLicense, IconLock, IconWorldOff } from '@tabler/icons-react';
import { Button } from '#site/components/button';
import { Container } from '#site/components/container';
import { useLang } from '#site/lib/i18n';
import { site } from '#site/lib/site';

// The ownership argument, given the weight of a full-width panel. The four points
// are the promise in plain terms; the terminal shows there is nothing more to it
// than one command. Kept on-palette: the "window controls" are neutral, not the
// decorative traffic lights that would drag a second colour in. The licence is
// GPL-2.0 (the whole site says so); it is never MIT.
const copy = {
  fr: {
    eyebrow: 'Auto-hébergé',
    headingPre: 'Conçu pour être ',
    headingAccent: 'possédé',
    headingPost: ', pas loué.',
    lead: 'Open source, sous licence GPL-2.0. Pas de compte à créer, pas d’abonnement, pas de service central qui pourrait fermer. Votre bibliothèque et votre activité ne quittent jamais votre réseau.',
    github: 'Voir sur GitHub',
    terminal: 'démarrer KROMA',
  },
  en: {
    eyebrow: 'Self-hosted',
    headingPre: 'Built to be ',
    headingAccent: 'owned',
    headingPost: ', not rented.',
    lead: 'Open source, under the GPL-2.0 license. No account to create, no subscription, no central service that could shut down. Your library and your activity never leave your network.',
    github: 'View on GitHub',
    terminal: 'start KROMA',
  },
} as const;

// The four promises. `Icon` is language-invariant, so only the title and its one
// line of proof carry a per-locale pair.
const POINTS = [
  {
    Icon: IconLicense,
    title: { fr: 'Libre', en: 'Free' },
    sub: { fr: 'Code ouvert, licence GPL-2.0', en: 'Open source, GPL-2.0 license' },
  },
  {
    Icon: IconLock,
    title: { fr: 'Privé', en: 'Private' },
    sub: { fr: 'Rien ne quitte votre réseau', en: 'Nothing leaves your network' },
  },
  {
    Icon: IconWorldOff,
    title: { fr: 'Sans central', en: 'No central service' },
    sub: { fr: 'Aucun compte, aucun abonnement', en: 'No account, no subscription' },
  },
  {
    Icon: IconCloudOff,
    title: { fr: 'Hors-ligne', en: 'Offline' },
    sub: { fr: 'La lecture fonctionne sans internet', en: 'Playback works without internet' },
  },
] as const;

export function SelfHostBand() {
  const lang = useLang();
  const t = copy[lang];

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="surface-hairline relative overflow-hidden rounded-3xl border border-border-strong bg-surface-1 p-8 sm:p-12">
          <div className="glow-amber pointer-events-none absolute inset-x-0 -top-24 h-56" />
          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
                {t.eyebrow}
              </p>
              <h2 className="text-balance font-display text-3xl font-extrabold leading-[1.05] text-text sm:text-4xl">
                {t.headingPre}
                <span className="text-gradient-amber">{t.headingAccent}</span>
                {t.headingPost}
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted">{t.lead}</p>

              <dl className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                {POINTS.map(({ Icon, title, sub }) => (
                  <div key={title.en} className="flex items-start gap-3">
                    <Icon
                      size={20}
                      stroke={1.75}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-accent"
                    />
                    <div>
                      <dt className="font-display text-sm font-bold text-text">{title[lang]}</dt>
                      <dd className="mt-0.5 text-sm text-muted">{sub[lang]}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="mt-9">
                <Button href={site.repo} variant="outline">
                  {t.github}
                </Button>
              </div>
            </div>

            {/* One command, and it is running. A real self-host line, not a mockup. */}
            <div className="overflow-hidden rounded-2xl border border-border bg-bg/80 shadow-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <span className="size-2.5 rounded-full border border-border-strong" aria-hidden />
                <span className="size-2.5 rounded-full border border-border-strong" aria-hidden />
                <span className="size-2.5 rounded-full border border-border-strong" aria-hidden />
                <span className="ml-2 font-mono text-[0.7rem] text-dim">{t.terminal}</span>
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
