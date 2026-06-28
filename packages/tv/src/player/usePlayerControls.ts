import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveRemoteKey } from '@luma/core';

export type Zone = 'progress' | 'bar';
/** Bottom control row, left → right. */
export const BAR = ['rewind', 'play', 'forward', 'av'] as const;

interface Args {
  playing: boolean;
  togglePlay: () => void;
  seek: (delta: number) => void;
  onExit: () => void;
  subOptions: (number | null)[];
  activeSub: number | null;
  pickSub: (index: number | null) => void;
}

export interface PlayerControls {
  controls: boolean;
  zone: Zone;
  barIndex: number;
  avOpen: boolean;
  avFocus: number;
  /** Is bottom-bar control `i` the focused one (and controls visible)? */
  barFocus: (i: number) => boolean;
}

/**
 * Owns the 10-foot control state (auto-hiding overlay, focus zone/index, AV
 * panel) and drives it entirely from the remote: ◀▶ move between controls, ▲
 * jumps to the progress bar, OK activates, Retour quits / closes the panel.
 */
export function usePlayerControls({ playing, togglePlay, seek, onExit, subOptions, activeSub, pickSub }: Args): PlayerControls {
  const [controls, setControls] = useState(true);
  const [zone, setZone] = useState<Zone>('bar');
  const [barIndex, setBarIndex] = useState(1); // start on Play
  const [avOpen, setAvOpen] = useState(false);
  const [avFocus, setAvFocus] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = useCallback(() => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setControls(false); // hide only while actively playing
    }, 3500);
  }, [playing]);

  // Keep controls visible while paused or the AV panel is open.
  useEffect(() => {
    if (!playing || avOpen) setControls(true);
    else poke();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing, avOpen, poke]);

  const openAv = useCallback(() => {
    setAvFocus(activeSub == null ? 0 : Math.max(0, subOptions.indexOf(activeSub)));
    setAvOpen(true);
  }, [activeSub, subOptions]);

  const activate = useCallback(
    (i: number) => {
      switch (BAR[i]) {
        case 'rewind':
          seek(-10);
          break;
        case 'play':
          togglePlay();
          break;
        case 'forward':
          seek(10);
          break;
        case 'av':
          openAv();
          break;
      }
    },
    [seek, togglePlay, openAv],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = resolveRemoteKey(e);
      if (!key) return;
      // Ignore auto-repeat for discrete OK actions — a held OK that entered the
      // player must not immediately toggle playback or re-trigger a control.
      if (e.repeat && (key === 'Enter' || key === 'PlayPause')) {
        e.preventDefault();
        return;
      }

      // Audio/subtitle panel captures navigation while open.
      if (avOpen) {
        switch (key) {
          case 'Up':
            setAvFocus((f) => Math.max(0, f - 1));
            break;
          case 'Down':
            setAvFocus((f) => Math.min(subOptions.length - 1, f + 1));
            break;
          case 'Enter':
          case 'PlayPause':
            pickSub(subOptions[avFocus] ?? null);
            break;
          case 'Back':
          case 'Stop':
            setAvOpen(false);
            break;
          default:
            return;
        }
        e.preventDefault();
        return;
      }

      if (key === 'Back' || key === 'Stop') {
        e.preventDefault();
        onExit();
        return;
      }

      const reveal = !controls;
      poke();
      switch (key) {
        case 'Up':
          setZone('progress');
          break;
        case 'Down':
          setZone('bar');
          break;
        case 'Left':
          if (reveal) break;
          if (zone === 'progress') seek(-10);
          else setBarIndex((i) => Math.max(0, i - 1));
          break;
        case 'Right':
          if (reveal) break;
          if (zone === 'progress') seek(10);
          else setBarIndex((i) => Math.min(BAR.length - 1, i + 1));
          break;
        case 'Enter':
        case 'PlayPause':
          if (reveal) break;
          if (zone === 'progress') togglePlay();
          else activate(barIndex);
          break;
        case 'Play':
          if (!playing) togglePlay();
          break;
        case 'Pause':
          if (playing) togglePlay();
          break;
        case 'FastForward':
          seek(30);
          break;
        case 'Rewind':
          seek(-10);
          break;
        default:
          break;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [avOpen, avFocus, subOptions, controls, zone, barIndex, playing, onExit, poke, seek, togglePlay, activate, pickSub]);

  const barFocus = (i: number) => controls && zone === 'bar' && barIndex === i;
  return { controls, zone, barIndex, avOpen, avFocus, barFocus };
}
