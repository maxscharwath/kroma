import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

/**
 * LUMA cinematic brand intro — ported 1:1 from the Claude Design source
 * ("LUMA Intro.dc.html"): a total-black open, an amber glow that ignites an
 * aperture mark (ring draw → orbit glint → centre-dot ignite → shockwave), an
 * impact flash + scale punch synced to the 1.30 s bass hit, the "LUMA" wordmark
 * reveal with a metal sheen, then the tagline. Drifting embers, a vignette and a
 * grain overlay sit on top.
 *
 * The whole timeline is choreographed to a ~5 s audio sting (bundled here, shared
 * by every client). Because browsers block autoplay-with-sound until a user
 * gesture, the visual timeline only *starts* once `audio.play()` resolves (or is
 * rejected) so picture and sound stay locked together; a pointer/key fallback
 * unblocks the sound on the first interaction, and a safety timer guarantees the
 * intro still ends even if audio never plays.
 *
 * It is intentionally framework-free — plain inline styles + an injected
 * `<style>` of @keyframes, no Tailwind — so it renders identically on the web
 * SSR shell and on old TV webviews (no cascade layers / color-mix needed). Mount
 * it as a full-screen overlay and call `onDone` to hand off to the app.
 */
export interface LumaIntroProps {
  /** Called once the intro has finished (audio ended, skipped, or "Entrer"). */
  onDone: () => void;
  /** Audio sting URL. Defaults to the bundled LUMA sting. */
  audioSrc?: string;
  /** Loop forever instead of ending (preview/idle-screen use). */
  loop?: boolean;
  /** Show the "Votre médiathèque, en grand" tagline. */
  showTagline?: boolean;
  /** Override the tagline copy. */
  tagline?: string;
  /** Show the on-screen Rejouer / Entrer buttons (web). TV hides them and shows
   * a key hint instead. */
  showControls?: boolean;
  /** "Enter the app" button label. */
  enterLabel?: string;
  /** "Replay" button label. */
  replayLabel?: string;
  /** Hint shown (bottom-centre) when controls are hidden — e.g. on TV. */
  skipHint?: string;
}

const DEFAULT_AUDIO = new URL('../assets/luma-intro.mp3', import.meta.url).href;

/** Fallback duration (ms) if the audio is blocked/unavailable — slightly longer
 * than the 4.992 s sting so a playing sting always reaches its own `ended`. */
const SAFETY_MS = 5400;
/** Exit fade-to-black length (ms) — matches the `transition` below. */
const EXIT_MS = 850;

const KEYFRAMES = `
@keyframes luma-igniteGlow{from{opacity:0;transform:scale(.5)}to{opacity:.5;transform:scale(1)}}
@keyframes luma-breathe{0%,100%{opacity:.38}50%{opacity:.62}}
@keyframes luma-dotIgnite{0%{opacity:0;transform:scale(0)}55%{opacity:1;transform:scale(1.55);filter:blur(2px)}75%{transform:scale(.82)}100%{opacity:1;transform:scale(1);filter:blur(0)}}
@keyframes luma-ringDraw{from{stroke-dashoffset:264}to{stroke-dashoffset:0}}
@keyframes luma-ringFade{from{opacity:0}to{opacity:1}}
@keyframes luma-orbit{from{transform:rotate(-15deg)}to{transform:rotate(360deg)}}
@keyframes luma-glintFade{0%{opacity:0}30%{opacity:1}100%{opacity:0}}
@keyframes luma-shock{0%{opacity:.75;transform:scale(.55)}100%{opacity:0;transform:scale(2.5)}}
@keyframes luma-flash{0%{opacity:0}10%{opacity:.9}100%{opacity:0}}
@keyframes luma-blackIn{0%{opacity:1}100%{opacity:0}}
@keyframes luma-punch{0%{transform:scale(.985)}38%{transform:scale(1.035)}100%{transform:scale(1)}}
@keyframes luma-wordReveal{0%{opacity:0;transform:translateY(16px) scale(.8);filter:blur(16px);text-shadow:0 0 0 rgba(242,180,66,0)}45%{opacity:1;transform:translateY(0) scale(1.06);filter:blur(0);text-shadow:0 0 30px rgba(255,214,98,.9)}68%{transform:scale(.99)}100%{opacity:1;transform:scale(1);text-shadow:0 0 14px rgba(242,180,66,.28)}}
@keyframes luma-sheen{0%{background-position:130% 0;opacity:0}25%{opacity:1}100%{background-position:-130% 0;opacity:0}}
@keyframes luma-tagIn{0%{opacity:0;letter-spacing:.2em}100%{opacity:1;letter-spacing:.42em}}
@keyframes luma-ctrlIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes luma-ember{0%{opacity:0;transform:translateY(0) scale(.5)}18%{opacity:.7}100%{opacity:0;transform:translateY(-46vmin) scale(1.1)}}
@keyframes luma-flicker{0%,100%{opacity:1}48%{opacity:.86}}
@media (prefers-reduced-motion: reduce){.luma-intro *{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important}}
`;

const GRAIN =
  "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')";

const EMBERS: ReadonlyArray<CSSProperties & { anim: string }> = [
  { left: '38%', bottom: '30%', width: 5, height: 5, background: '#F4B642', filter: 'blur(1px)', anim: 'luma-ember 5.5s ease-in 1.2s infinite backwards' },
  { left: '58%', bottom: '34%', width: 4, height: 4, background: '#FFD262', filter: 'blur(1px)', anim: 'luma-ember 6.2s ease-in 2.1s infinite backwards' },
  { left: '46%', bottom: '28%', width: 6, height: 6, background: '#F4B642', filter: 'blur(1.5px)', anim: 'luma-ember 6.8s ease-in 1.7s infinite backwards' },
  { left: '64%', bottom: '31%', width: 3, height: 3, background: '#FFE7A8', filter: 'blur(1px)', anim: 'luma-ember 5.9s ease-in 3s infinite backwards' },
  { left: '33%', bottom: '33%', width: 4, height: 4, background: '#F4B642', filter: 'blur(1px)', anim: 'luma-ember 7s ease-in 2.6s infinite backwards' },
];

const WORDMARK: CSSProperties = {
  fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
  fontWeight: 800,
  fontSize: '12vmin',
  letterSpacing: '.16em',
  whiteSpace: 'nowrap',
};

export function LumaIntro({
  onDone,
  audioSrc = DEFAULT_AUDIO,
  loop = false,
  showTagline = true,
  tagline = 'Votre médiathèque, en grand',
  showControls = true,
  enterLabel = 'Entrer',
  replayLabel = 'Rejouer',
  skipHint = 'OK · Passer',
}: LumaIntroProps) {
  // `started` gates the animated layers so the CSS timeline begins exactly at
  // audio onset. `runId` is the React key that restarts every animation on replay.
  const [started, setStarted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [runId, setRunId] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const exitRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const exitedRef = useRef(false);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  // Latest onDone without re-running the mount effect (avoids re-arming audio).
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const exit = useCallback(() => {
    if (exitedRef.current) return;
    exitedRef.current = true;
    clearTimeout(safetyRef.current);
    setExiting(true);
    exitRef.current = setTimeout(() => onDoneRef.current(), EXIT_MS);
  }, []);

  const start = useCallback(() => {
    exitedRef.current = false;
    clearTimeout(safetyRef.current);
    clearTimeout(exitRef.current);
    setExiting(false);
    setStarted(false);
    const a = audioRef.current;
    // Kick the visual timeline at audio onset so the flash/punch land on the
    // 1.30 s bass hit (the keyframe delays are timed to the sting).
    const begin = () => setStarted(true);
    if (a) {
      try {
        a.currentTime = 0;
      } catch {
        /* not yet seekable — harmless */
      }
      const p = a.play();
      if (p && typeof p.then === 'function') p.then(begin).catch(begin);
      else begin();
    } else {
      begin();
    }
    if (!loopRef.current) safetyRef.current = setTimeout(exit, SAFETY_MS);
  }, [exit]);

  const replay = useCallback(() => {
    clearTimeout(safetyRef.current);
    clearTimeout(exitRef.current);
    setRunId((n) => n + 1);
    start();
  }, [start]);

  useEffect(() => {
    const a = new Audio(audioSrc);
    a.preload = 'auto';
    audioRef.current = a;

    const onEnded = () => {
      if (loopRef.current) replay();
      else exit();
    };
    a.addEventListener('ended', onEnded);

    // Browsers block autoplay-with-sound until a gesture: arm a one-shot
    // unblock on the first pointer/key, then run the synced timeline.
    const unblock = () => {
      if (a.paused) {
        try {
          a.currentTime = 0;
        } catch {
          /* harmless */
        }
        void a.play().then(() => setStarted(true)).catch(() => undefined);
      }
    };
    document.addEventListener('pointerdown', unblock);
    document.addEventListener('keydown', unblock);

    // Skip / replay via keyboard + TV remote (OK/Enter, Space, Back/Escape).
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'Enter' || k === ' ' || k === 'Spacebar' || k === 'Escape' || k === 'GoBack' || k === 'BrowserBack') {
        e.preventDefault();
        e.stopImmediatePropagation();
        exit();
      } else if (k === 'r' || k === 'R') {
        e.preventDefault();
        e.stopImmediatePropagation();
        replay();
      }
    };
    // Capture phase so the TV's spatial focus-nav underneath stays inert.
    window.addEventListener('keydown', onKey, true);

    start();

    return () => {
      clearTimeout(safetyRef.current);
      clearTimeout(exitRef.current);
      a.pause();
      a.removeEventListener('ended', onEnded);
      document.removeEventListener('pointerdown', unblock);
      document.removeEventListener('keydown', unblock);
      window.removeEventListener('keydown', onKey, true);
    };
    // Re-arm only if the audio source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc]);

  return (
    <div
      className="luma-intro"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
        background: '#0A0A0C',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
      }}
      role="img"
      aria-label="LUMA"
    >
      <style>{KEYFRAMES}</style>

      {started ? (
        // Keyed so every CSS animation restarts from frame 0 on replay.
        <div key={runId} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* opaque black opening: guarantees a total-black start */}
          <div style={{ position: 'absolute', inset: 0, background: '#0A0A0C', zIndex: 40, pointerEvents: 'none', animation: 'luma-blackIn .7s ease .35s both' }} />

          {/* ambient amber glow */}
          <div
            style={{
              position: 'absolute',
              width: '74vmin',
              height: '74vmin',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(242,180,66,.55), rgba(242,180,66,.12) 42%, transparent 70%)',
              filter: 'blur(18px)',
              animation: 'luma-igniteGlow 1.15s ease .25s both, luma-breathe 4s ease-in-out 1.4s infinite backwards',
            }}
          />
          {/* impact flash (synced to 1.30s bass hit) */}
          <div
            style={{
              position: 'absolute',
              width: '120vmax',
              height: '120vmax',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,236,190,.9), rgba(242,180,66,.38) 16%, transparent 44%)',
              animation: 'luma-flash .55s ease-out 1.27s both',
              pointerEvents: 'none',
            }}
          />

          {/* embers */}
          {EMBERS.map(({ anim, ...s }, i) => (
            <div key={i} style={{ position: 'absolute', borderRadius: '50%', animation: anim, ...s }} />
          ))}

          {/* lockup */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '5.4vmin',
              animation: 'luma-punch .55s cubic-bezier(.34,1.56,.64,1) 1.27s both, luma-flicker 6s ease-in-out 2s infinite',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
          >
            {/* aperture mark */}
            <div style={{ position: 'relative', width: '23vmin', height: '23vmin', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', width: '62%', height: '62%', borderRadius: '50%', border: '2px solid rgba(242,180,66,.6)', animation: 'luma-shock 1.1s ease-out 1.27s both' }} />
              <svg viewBox="0 0 100 100" style={{ position: 'absolute', width: '100%', height: '100%', transform: 'rotate(-90deg)', overflow: 'visible' }}>
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#F4B642"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeDasharray="264"
                  style={{ animation: 'luma-ringDraw .9s cubic-bezier(.6,0,.2,1) .4s both, luma-ringFade .3s ease .4s both', filter: 'drop-shadow(0 0 7px rgba(242,180,66,.7))' }}
                />
              </svg>
              <div style={{ position: 'absolute', width: '100%', height: '100%', animation: 'luma-orbit 1s cubic-bezier(.6,0,.2,1) .4s both, luma-glintFade .7s ease 1s both' }}>
                <div style={{ position: 'absolute', top: '4%', left: '50%', width: '7%', height: '7%', borderRadius: '50%', background: '#FFE7A8', transform: 'translateX(-50%)', filter: 'blur(2px)', boxShadow: '0 0 12px 4px rgba(255,210,98,.9)' }} />
              </div>
              <div style={{ position: 'absolute', width: '16%', height: '16%', borderRadius: '50%', background: '#F4B642', boxShadow: '0 0 20px 6px rgba(242,180,66,.85), 0 0 40px 12px rgba(242,180,66,.35)', animation: 'luma-dotIgnite .7s cubic-bezier(.22,1,.36,1) .95s both' }} />
            </div>

            {/* wordmark */}
            <div style={{ position: 'relative', lineHeight: 1 }}>
              <div style={{ ...WORDMARK, color: '#F4F3F0' }}>
                <span style={{ display: 'inline-block', animation: 'luma-wordReveal .75s cubic-bezier(.2,.9,.25,1) 1.27s both', willChange: 'transform,filter,opacity' }}>LUMA</span>
              </div>
              <div
                style={{
                  ...WORDMARK,
                  position: 'absolute',
                  inset: 0,
                  color: 'transparent',
                  background: 'linear-gradient(100deg,transparent 32%,rgba(255,255,255,.92) 50%,transparent 68%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  backgroundSize: '300% 100%',
                  animation: 'luma-sheen .85s ease 2.05s both',
                  pointerEvents: 'none',
                }}
              >
                LUMA
              </div>
            </div>

            {/* tagline */}
            {showTagline ? (
              <div style={{ fontWeight: 700, fontSize: '1.8vmin', letterSpacing: '.42em', textTransform: 'uppercase', color: 'rgba(244,243,240,.52)', whiteSpace: 'nowrap', animation: 'luma-tagIn .85s ease 2.5s both' }}>
                {tagline}
              </div>
            ) : null}
          </div>

          {/* vignette + grain */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.62))' }} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.05, mixBlendMode: 'overlay', background: GRAIN }} />

          {/* controls (web) */}
          {showControls ? (
            <div style={{ position: 'absolute', bottom: '5vmin', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 14, animation: 'luma-ctrlIn .7s ease 3.2s both' }}>
              <button
                type="button"
                onClick={replay}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.16)', color: 'rgba(244,243,240,.78)', font: "600 14px 'Hanken Grotesk', system-ui, sans-serif", padding: '11px 22px', borderRadius: 999, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5" /></svg>
                {replayLabel}
              </button>
              <button
                type="button"
                onClick={exit}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#F4B642', border: 'none', color: '#0A0A0C', font: "700 14px 'Hanken Grotesk', system-ui, sans-serif", padding: '11px 24px', borderRadius: 999, cursor: 'pointer' }}
              >
                {enterLabel}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          ) : skipHint ? (
            <div style={{ position: 'absolute', bottom: '5vmin', left: 0, right: 0, textAlign: 'center', fontSize: '1.7vmin', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(244,243,240,.4)', animation: 'luma-ctrlIn .7s ease 3.2s both' }}>
              {skipHint}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* exit transition to the app */}
      <div style={{ position: 'absolute', inset: 0, background: '#0A0A0C', opacity: exiting ? 1 : 0, transition: 'opacity .8s ease', pointerEvents: 'none', zIndex: 50 }} />
    </div>
  );
}
