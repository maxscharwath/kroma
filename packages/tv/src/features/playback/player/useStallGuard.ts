import { driveStallRecovery, STALL_NUDGE_SEC, type StallSample } from '@kroma/core';
import { useEffect, useState } from 'react';
import type { TvEngine } from '#tv/features/playback/player/engine';

/**
 * Works a stuck playhead back up on whichever engine is playing: a nudge, then
 * the backend's own recovery, then a fresh source at the same position. Returns
 * whether it is stuck right now, which the chrome shows as buffering rather than
 * as a healthy full bar.
 */
export function useStallGuard(
  engineRef: React.RefObject<TvEngine | null>,
  active: boolean,
): boolean {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (!active) return;
    return driveStallRecovery(
      {
        sample: (): StallSample | null => {
          const engine = engineRef.current;
          const bufferedEnd = engine?.bufferedEnd();
          if (!engine || bufferedEnd == null) return null;
          return {
            currentTime: engine.position(),
            bufferedEnd,
            paused: engine.isPaused(),
          };
        },
        nudge: () => {
          const engine = engineRef.current;
          if (engine) engine.seekTo(engine.position() + STALL_NUDGE_SEC);
        },
        recover: () => engineRef.current?.recoverStall?.() === true,
        restart: () => {
          const engine = engineRef.current;
          engine?.restart?.(engine.position());
        },
      },
      setStalled,
    );
  }, [active, engineRef]);

  return stalled;
}
