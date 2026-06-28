import type { LumaClient, MediaItem } from '@luma/core';
import { useCallback, useEffect } from 'react';

/**
 * Resume + progress persistence for the TV direct player, sharing the engine's
 * `<video>` ref: restores the saved resume position once metadata is available,
 * then persists progress every 10 s, on pause, on ~finish, and on exit (cleanup).
 */
export function useResumeAndPersist(
  client: LumaClient,
  item: MediaItem,
  videoRef: React.RefObject<HTMLVideoElement>,
): void {
  // Restore the saved resume position once metadata is available.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !client.hasAuth) return;
    let cancelled = false;
    let applied = false;
    const apply = (sec: number) => {
      if (applied) return;
      applied = true;
      if (v.currentTime < sec - 2) v.currentTime = sec;
    };
    client
      .itemProgress(item.id)
      .then((p) => {
        if (cancelled || !p) return;
        const durMs = p.durationMs ?? item.durationMs ?? 0;
        const posSec = p.positionMs / 1000;
        if (posSec > 15 && (!durMs || p.positionMs < durMs * 0.95)) {
          if (v.readyState >= 1) apply(posSec);
          else v.addEventListener('loadedmetadata', () => apply(posSec), { once: true });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, item]);

  const saveProgress = useCallback(() => {
    const v = videoRef.current;
    if (!v || !client.hasAuth) return;
    const d = v.duration;
    const pos = v.currentTime;
    if (!Number.isFinite(d) || d <= 0 || pos < 5) return;
    if (pos > d * 0.97) void client.deleteProgress(item.id);
    else void client.saveProgress(item.id, pos * 1000, d * 1000);
  }, [client, item]);

  // Persist every 10 s, on pause, on ~finish, and on exit (cleanup).
  useEffect(() => {
    if (!client.hasAuth) return;
    const v = videoRef.current;
    const interval = setInterval(saveProgress, 10000);
    const onEnded = () => void client.deleteProgress(item.id);
    v?.addEventListener('pause', saveProgress);
    v?.addEventListener('ended', onEnded);
    return () => {
      clearInterval(interval);
      v?.removeEventListener('pause', saveProgress);
      v?.removeEventListener('ended', onEnded);
      saveProgress();
    };
  }, [client, item, saveProgress]);
}
