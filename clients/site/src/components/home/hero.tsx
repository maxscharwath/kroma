import { useRef } from 'react';
import { Button } from '#site/components/button';
import { Container } from '#site/components/container';
import { HeroBeams } from '#site/components/home/hero-beams';
import { WheelMark } from '#site/components/wheel-mark';
import { site } from '#site/lib/site';

// Above the fold: the chromatic mark over the intro film's neon burst, the
// promise, two actions, and three specifics that keep the "one binary" claim
// from being a slogan. The entrance is a pure-CSS staggered rise: it needs no JS
// and no scroll observer, so it plays on the prerendered HTML too, and
// `motion-safe:` drops it entirely for readers who ask for stillness.
export function Hero() {
  // The burst locks its origin onto the wheel; the ref hands the canvas that node.
  const wheelRef = useRef<HTMLSpanElement>(null);

  return (
    <section className="relative overflow-hidden">
      {/* A faint amber source, painted behind the canvas so a browser without
          WebGL still gets warmth rather than flat charcoal. */}
      <div className="glow-amber pointer-events-none absolute inset-x-0 -top-24 h-[620px]" />
      <HeroBeams anchorRef={wheelRef} />
      {/* Fade the opaque burst into the page and keep the lower copy readable. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />

      <Container>
        <div className="relative z-10 flex flex-col items-center py-24 text-center sm:py-32">
          {/* The rise lives on the wrapper, not the mark itself: the mark already
              owns an `animation` (its slow spin), and two on one element collide. */}
          <div className="mb-8 motion-safe:animate-rise">
            <span ref={wheelRef} className="inline-block">
              <WheelMark size={76} spin />
            </span>
          </div>

          {/* The factual, technical voice, set in mono the way the app labels a
              codec or a build. */}
          <p
            className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-border bg-surface-1/60 px-3.5 py-1.5 font-mono text-xs tracking-tight text-muted backdrop-blur-sm motion-safe:animate-rise"
            style={{ animationDelay: '60ms' }}
          >
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden />
            un seul binaire Rust · open source · MIT
          </p>

          <h1
            className="max-w-4xl text-balance font-display text-5xl font-extrabold leading-[1.02] text-text motion-safe:animate-rise sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '120ms' }}
          >
            Votre médiathèque, <span className="text-gradient-amber">chez vous</span>.
          </h1>

          <p
            className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted motion-safe:animate-rise sm:text-xl"
            style={{ animationDelay: '180ms' }}
          >
            {site.description}
          </p>

          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-3 motion-safe:animate-rise"
            style={{ animationDelay: '240ms' }}
          >
            <Button to="/download" size="lg">
              Installer KROMA
            </Button>
            <Button href={site.repo} variant="outline" size="lg">
              Voir le code
            </Button>
          </div>

          <ul
            className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-xs text-dim motion-safe:animate-rise"
            style={{ animationDelay: '320ms' }}
          >
            <li>démarre en millisecondes</li>
            <li aria-hidden className="text-border-strong">
              ·
            </li>
            <li>zéro conteneur</li>
            <li aria-hidden className="text-border-strong">
              ·
            </li>
            <li>la vidéo n’est jamais ré-encodée</li>
          </ul>
        </div>
      </Container>
    </section>
  );
}
