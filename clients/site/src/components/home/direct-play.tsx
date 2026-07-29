import { Container } from '#site/components/container';

// The playback story gets its own focused moment. The claim is blunt — the server
// never transcodes video — and the right rail proves it two ways: the codecs the
// clients decode themselves, and a NAS-CPU meter parked near zero because there is
// no transcode to run. HEVC is lit in amber as the hero codec; the rest stay
// neutral, so the row keeps to the single-accent rule.
const CODECS = [
  { label: 'HEVC / H.265', hero: true },
  { label: '10-bit · HDR', hero: false },
  { label: 'AV1', hero: false },
  { label: 'H.264', hero: false },
  { label: 'AAC', hero: false },
  { label: 'AC3 / EAC3', hero: false },
] as const;

export function DirectPlay() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
              Direct-play, HEVC d’abord
            </p>
            <h2 className="text-balance font-display text-3xl font-extrabold leading-[1.05] text-text sm:text-4xl">
              Le serveur ne <span className="text-gradient-amber">transcode jamais</span> la vidéo.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted">
              KROMA diffuse les fichiers originaux par plages d’octets ; chaque client décode le
              HEVC/H.265 lui-même — en 10-bit et en HDR, en matériel sur les téléviseurs Samsung et
              LG. Pas de pipeline de transcodage, pas de ferme de CPU à garder au chaud.
            </p>
            <p className="mt-4 max-w-md font-mono text-xs leading-relaxed text-dim">
              Seule exception : un flux audio-only HLS pour les navigateurs qui ne décodent pas
              AC3/EAC3/DTS. La vidéo est copiée, seul l’audio passe en AAC stéréo.
            </p>
          </div>

          <div className="surface-hairline rounded-2xl border border-border bg-surface-1/50 p-6 shadow-card sm:p-8">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-dim">
              Décodé par le client
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CODECS.map((c) => (
                <span
                  key={c.label}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs ${
                    c.hero
                      ? 'border-accent/40 bg-accent-soft text-accent'
                      : 'border-border bg-bg text-muted'
                  }`}
                >
                  {c.label}
                </span>
              ))}
            </div>

            <div className="mt-8 h-px bg-border" />

            {/* The whole point, as one gauge: nothing to transcode means the box
                stays cold. A sliver of amber near the origin, not a full bar. */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs text-muted">CPU du NAS pendant la lecture</span>
                <span className="font-mono text-xs text-accent">au repos</span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full w-[4%] rounded-full bg-accent" />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-dim">
                Rien à ré-encoder : la lecture ne réveille pas le processeur. Votre NAS reste
                disponible pour tout le reste.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
