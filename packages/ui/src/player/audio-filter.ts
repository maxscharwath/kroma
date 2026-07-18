import { type RefObject, useCallback, useEffect, useState } from 'react';
import type { AudioFilterMode } from './types';

/**
 * Audio filter / volume normalizer (§7). A Web Audio compressor + make-up gain
 * behind the player's <video>, so it works on EVERY playback mode (direct play
 * included) without a server transcode:
 *   - off      source → destination (untouched)
 *   - standard levels the loud/quiet gap (gentle 4:1 compression + a little gain)
 *   - night    clamps loud peaks hard and lifts dialogue (12:1, low threshold)
 * Persisted like the subtitle appearance.
 */

const KEY = 'kroma.audioFilter';

// One page-wide AudioContext, created on first enable (a user gesture, so it is
// never born suspended by autoplay policy) and kept for the tab's lifetime.
let sharedCtx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!sharedCtx) {
    sharedCtx = new AudioContext();
    // A persisted filter hydrates WITHOUT a user gesture, so the context can be
    // born suspended and an element routed into a suspended context is MUTED.
    // Any interaction un-sticks it (a no-op once running, so keep it forever).
    const resume = () => {
      if (sharedCtx?.state === 'suspended') void sharedCtx.resume();
    };
    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
  }
  if (sharedCtx.state === 'suspended') void sharedCtx.resume();
  return sharedCtx;
}

interface Graph {
  source: MediaElementAudioSourceNode;
  comp: DynamicsCompressorNode;
  gain: GainNode;
}

// `createMediaElementSource` is once-per-element for the element's LIFETIME (a
// second call throws), and the player REMOUNTS its <video> on re-anchor / audio
// switch, so graphs are keyed by element, not by player instance.
const graphs = new WeakMap<HTMLMediaElement, Graph>();

function configure(g: Graph, mode: Exclude<AudioFilterMode, 'off'>): void {
  const { comp, gain } = g;
  if (mode === 'standard') {
    comp.threshold.value = -24;
    comp.knee.value = 30;
    comp.ratio.value = 4;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    gain.gain.value = 1.4;
  } else {
    // night: aggressive limiting of peaks, dialogue lifted the most.
    comp.threshold.value = -40;
    comp.knee.value = 20;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    gain.gain.value = 1.8;
  }
}

/** Route (or re-route) an element's audio for the given mode. Off with no
 * existing graph is a no-op the element keeps its native output path. Once a
 * graph exists the element's audio ALWAYS flows through it, so "off" becomes a
 * straight source → destination wire. */
function wire(el: HTMLMediaElement, mode: AudioFilterMode): void {
  if (mode === 'off' && !graphs.has(el)) return;
  const ctx = audioCtx();
  if (!ctx) return;

  let g = graphs.get(el);
  if (!g) {
    const source = ctx.createMediaElementSource(el);
    const comp = ctx.createDynamicsCompressor();
    const gain = ctx.createGain();
    comp.connect(gain);
    gain.connect(ctx.destination);
    g = { source, comp, gain };
    graphs.set(el, g);
  }

  g.source.disconnect();
  if (mode === 'off') {
    g.source.connect(ctx.destination);
  } else {
    configure(g, mode);
    g.source.connect(g.comp);
  }
}

/**
 * The normalizer hook. `remountKey` must change whenever the parent remounts the
 * <video> (anchor / audio track) so the graph re-attaches to the fresh element.
 */
export function useAudioFilter(
  videoRef: RefObject<HTMLVideoElement | null>,
  remountKey: string,
): { mode: AudioFilterMode; setMode: (m: AudioFilterMode) => void; supported: boolean } {
  const [modeState, setModeState] = useState<AudioFilterMode>('off');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof AudioContext !== 'undefined');
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === 'standard' || raw === 'night') setModeState(raw);
    } catch {
      /* ignore */
    }
  }, []);

  // Re-wire on mode change AND on <video> remount (fresh element, fresh graph).
  // biome-ignore lint/correctness/useExhaustiveDependencies: remountKey tracks the element identity.
  useEffect(() => {
    const v = videoRef.current;
    if (v) wire(v, modeState);
  }, [modeState, remountKey, videoRef]);

  const setMode = useCallback((m: AudioFilterMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  return { mode: modeState, setMode, supported };
}
