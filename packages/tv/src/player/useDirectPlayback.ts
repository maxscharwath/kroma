import { useCallback, useEffect, useRef, useState } from 'react';
import { attachDirectPlay, type DirectPlayVerdict, type LumaClient, type MediaItem } from '@luma/core';

export interface Playback {
  videoRef: React.RefObject<HTMLVideoElement>;
  verdict: DirectPlayVerdict | null;
  error: string | null;
  playing: boolean;
  waiting: boolean;
  cur: number;
  dur: number;
  bufEnd: number;
  togglePlay: () => void;
  /** Seek by `delta` seconds, clamped to [0, duration]. */
  seek: (delta: number) => void;
}

/**
 * Direct-play a media item in a `<video>`: attaches the source, mirrors the
 * element's playback state into React, restores the saved resume position, and
 * persists progress (every 10 s, on pause/ended, and on unmount).
 */
export function useDirectPlayback(client: LumaClient, item: MediaItem): Playback {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [verdict, setVerdict] = useState<DirectPlayVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(item.durationMs ? item.durationMs / 1000 : 0);
  const [bufEnd, setBufEnd] = useState(0);

  // Attach the stream + mirror element state into React.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setVerdict(attachDirectPlay(v, client, item, { autoplay: true }));

    const onTime = () => setCur(v.currentTime);
    const onDur = () => setDur(v.duration || (item.durationMs ? item.durationMs / 1000 : 0));
    const onProg = () => setBufEnd(v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onErr = () => setError('Lecture impossible — flux indisponible ou codec non pris en charge.');

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('progress', onProg);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('error', onErr);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('progress', onProg);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('error', onErr);
    };
  }, [client, item]);

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

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const seek = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const target = v.currentTime + delta;
    const max = v.duration || target;
    v.currentTime = Math.max(0, Math.min(max, target));
  }, []);

  return { videoRef, verdict, error, playing, waiting, cur, dur, bufEnd, togglePlay, seek };
}
