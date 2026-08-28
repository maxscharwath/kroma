import {
  reachableBufferEnd,
  STALL_NUDGE_SEC,
  STALL_POLL_MS,
  type StallStep,
  stallWatch,
} from '@kroma/core';
import { useEffect, useRef, useState } from 'react';
import type { HlsInstance, ShakaPlayerLike } from '#web/features/playback/video-engine';

// A restart re-anchors the stream, which costs a fresh remux session: worth it
// once for a picture that is otherwise frozen, not worth it in a loop.
const RESTART_COOLDOWN_MS = 30_000;

export interface StallRecoveryOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsRef: { current: HlsInstance | null };
  shakaRef: { current: ShakaPlayerLike | null };
  /** The anchor the element's clock is relative to, so a restart can name the
   * absolute position the picture froze at. */
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
  const restartedAt = useRef(0);

  useEffect(() => {
    if (!active) return;
    const watch = stallWatch();

    const apply = (step: StallStep, v: HTMLVideoElement) => {
      if (step === 'nudge') {
        v.currentTime += STALL_NUDGE_SEC;
        return;
      }
      if (step === 'recover') {
        if (shakaRef.current) shakaRef.current.retryStreaming();
        else hlsRef.current?.recoverMediaError();
        return;
      }
      const now = Date.now();
      if (now - restartedAt.current < RESTART_COOLDOWN_MS) return;
      restartedAt.current = now;
      onRestart(baseSec + v.currentTime);
    };

    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      const step = watch.observe(
        {
          currentTime: v.currentTime,
          bufferedEnd: reachableBufferEnd(v.buffered, v.currentTime),
          paused: v.paused,
          ended: v.ended,
          seeking: v.seeking,
          readyState: v.readyState,
        },
        Date.now(),
      );
      setStalled(watch.stalled());
      if (step) apply(step, v);
    }, STALL_POLL_MS);

    return () => {
      clearInterval(id);
      setStalled(false);
    };
  }, [active, baseSec, onRestart, videoRef, hlsRef, shakaRef]);

  return stalled;
}
