import {
  driveStallRecovery,
  reachableBufferEnd,
  STALL_NUDGE_SEC,
  type StallSample,
} from '@kroma/core';
import { useEffect, useState } from 'react';
import type { HlsInstance, ShakaPlayerLike } from '#web/features/playback/video-engine';

export interface StallRecoveryOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsRef: { current: HlsInstance | null };
  shakaRef: { current: ShakaPlayerLike | null };
  baseSec: number;
  active: boolean;
  onRestart: (absSec: number) => void;
}

/**
 * Works a stuck playhead back up: a nudge, then the engine's own recovery, then
 * a fresh source at the same position. Returns whether it is stuck right now,
 * which the chrome shows as buffering rather than as a healthy full bar.
 */
export function useStallRecovery(opts: StallRecoveryOptions): boolean {
  const { videoRef, hlsRef, shakaRef, baseSec, active, onRestart } = opts;
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (!active) return;
    return driveStallRecovery(
      {
        sample: (): StallSample | null => {
          const v = videoRef.current;
          if (!v) return null;
          return {
            currentTime: v.currentTime,
            bufferedEnd: reachableBufferEnd(v.buffered, v.currentTime),
            paused: v.paused,
            ended: v.ended,
            seeking: v.seeking,
            readyState: v.readyState,
          };
        },
        nudge: () => {
          const v = videoRef.current;
          if (v) v.currentTime += STALL_NUDGE_SEC;
        },
        recover: () => {
          if (shakaRef.current) return shakaRef.current.retryStreaming();
          if (!hlsRef.current) return false;
          hlsRef.current.recoverMediaError();
          return true;
        },
        restart: () => {
          const v = videoRef.current;
          if (v) onRestart(baseSec + v.currentTime);
        },
      },
      setStalled,
    );
  }, [active, baseSec, onRestart, videoRef, hlsRef, shakaRef]);

  return stalled;
}
