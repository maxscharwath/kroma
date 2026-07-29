import { Fragment, useRef } from 'react';
import { Button } from '#site/components/button';
import { Container } from '#site/components/container';
import { HeroBeams } from '#site/components/home/hero-beams';
import { useLang } from '#site/lib/i18n';
import { site } from '#site/lib/site';

// Above-the-fold copy in both languages. The heading is split into three parts so
// the amber gradient span keeps its exact place in each language rather than being
// reconstructed with a fragile find-and-replace on a whole sentence. `description`
// reuses the single source of truth in `site` (one per locale) so the hero lead
// and the SEO meta can never drift apart.
const copy = {
  fr: {
    pill: 'un seul binaire Rust · open source · GPL-2.0',
    headingPre: 'Votre médiathèque, ',
    headingAccent: 'chez vous',
    headingPost: '.',
    description: site.description,
    install: 'Installer KROMA',
    code: 'Voir le code',
    facts: ['démarre en millisecondes', 'zéro conteneur', 'la vidéo n’est jamais ré-encodée'],
  },
  en: {
    pill: 'a single Rust binary · open source · GPL-2.0',
    headingPre: 'Your media library, ',
    headingAccent: 'at home',
    headingPost: '.',
    description: site.descriptionEn,
    install: 'Install KROMA',
    code: 'View the code',
    facts: ['starts in milliseconds', 'zero containers', 'video is never re-encoded'],
  },
} as const;

// Above the fold: the chromatic mark over the intro film's neon burst, the
// promise, two actions, and three specifics that keep the "one binary" claim
// from being a slogan. The entrance is a pure-CSS staggered rise: it needs no JS
// and no scroll observer, so it plays on the prerendered HTML too, and
// `motion-safe:` drops it entirely for readers who ask for stillness.
export function Hero() {
  // The burst locks its origin onto the lockup; the ref hands the canvas that node.
  const markRef = useRef<HTMLSpanElement>(null);
  const t = copy[useLang()];

  return (
    <section className="relative overflow-hidden">
      {/* A faint amber source, painted behind the canvas so a browser without
          WebGL still gets warmth rather than flat charcoal. */}
      <div className="glow-amber pointer-events-none absolute inset-x-0 -top-24 h-[620px]" />
      <HeroBeams anchorRef={markRef} />
      {/* Fade the opaque burst into the page and keep the lower copy readable. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />

      <Container>
        <div className="relative z-10 flex flex-col items-center py-24 text-center sm:py-32">
          {/* The full KROMA lockup, standing in the burst it converges on. */}
          <div className="mb-9 motion-safe:animate-rise">
            <span ref={markRef} className="inline-block">
              <img
                src="/kroma-lockup.svg"
                alt="KROMA"
                width={458}
                height={100}
                className="h-11 w-auto drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)] sm:h-14"
              />
            </span>
          </div>

          {/* The factual, technical voice, set in mono the way the app labels a
              codec or a build. */}
          <p
            className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-border bg-surface-1/60 px-3.5 py-1.5 font-mono text-xs tracking-tight text-muted backdrop-blur-sm motion-safe:animate-rise"
            style={{ animationDelay: '60ms' }}
          >
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden />
            {t.pill}
          </p>

          <h1
            className="max-w-4xl text-balance font-display text-5xl font-extrabold leading-[1.02] text-text motion-safe:animate-rise sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '120ms' }}
          >
            {t.headingPre}
            <span className="text-gradient-amber">{t.headingAccent}</span>
            {t.headingPost}
          </h1>

          <p
            className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted motion-safe:animate-rise sm:text-xl"
            style={{ animationDelay: '180ms' }}
          >
            {t.description}
          </p>

          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-3 motion-safe:animate-rise"
            style={{ animationDelay: '240ms' }}
          >
            <Button to="/download" size="lg">
              {t.install}
            </Button>
            <Button href={site.repo} variant="outline" size="lg">
              {t.code}
            </Button>
          </div>

          <ul
            className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-xs text-dim motion-safe:animate-rise"
            style={{ animationDelay: '320ms' }}
          >
            {t.facts.map((fact, i) => (
              // Middot separators live between items only, so they map off the
              // same list and stay aria-hidden as pure punctuation.
              <Fragment key={fact}>
                {i > 0 && (
                  <li aria-hidden className="text-border-strong">
                    ·
                  </li>
                )}
                <li>{fact}</li>
              </Fragment>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
