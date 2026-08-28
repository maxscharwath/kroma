import { STALL_NUDGE_SEC, STALL_POLL_MS, type StallStep, stallWatch } from '@kroma/core';
import { useEffect, useRef, useState } from 'react';
import type { TvEngine } from '#tv/features/playback/player/engine';

// A restart re-anchors the stream, which costs a fresh remux session: worth it
// once for a picture that is otherwise frozen, not worth it in a loop.
const RESTART_COOLDOWN_MS = 30_000;

/**
 * Watches whichever engine is playing for a playhead that has stopped with
 * buffer still ahead of it, and works it back up: a nudge, then the backend's
 * own recovery, then a fresh source at the same position. Returns whether it is
 * stuck right now, which the chrome shows as buffering rather than as a healthy
 * full bar.
 */
export function useStallGuard(
  engineRef: React.RefObject<TvEngine | null>,
  active: boolean,
): boolean {
  const [stalled, setStalled] = useState(false);
  const restartedAt = useRef(0);

  useEffect(() => {
    if (!active) return;
    const watch = stallWatch();

    const apply = (step: StallStep, engine: TvEngine) => {
      const at = engine.position();
      if (step === 'nudge') {
        engine.seekTo(at + STALL_NUDGE_SEC);
        return;
      }
      if (step === 'recover' && engine.recoverStall?.() === true) return;
      const now = Date.now();
      if (now - restartedAt.current < RESTART_COOLDOWN_MS) return;
      restartedAt.current = now;
      engine.restart?.(at);
    };

    const id = setInterval(() => {
      const engine = engineRef.current;
      // A backend with no buffered range to report cannot tell a stall from an
      // honest rebuffer, so it is left to its own devices.
      const bufferedEnd = engine?.bufferedEnd();
      if (!engine || bufferedEnd == null) return;
      const step = watch.observe(
        {
          currentTime: engine.position(),
          bufferedEnd,
          paused: engine.isPaused(),
        },
        Date.now(),
      );
      setStalled(watch.stalled());
      if (step) apply(step, engine);
    }, STALL_POLL_MS);

    return () => {
      clearInterval(id);
      setStalled(false);
    };
  }, [active, engineRef]);

  return stalled;
}
