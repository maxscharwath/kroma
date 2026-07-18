import { type RemoteKey, resolveRemoteKey } from '@kroma/core';
import { type RefObject, useEffect, useRef } from 'react';
import type { PanelHandle } from './nav';
import type { PlayerController, PlayerFlags } from './types';
import type { PlayerNav } from './usePlayerNav';

export interface PlayerKeysParams {
  nav: PlayerNav;
  controller: PlayerController;
  flags: PlayerFlags;
  /** The currently-open panel (settings / sheet); keys route here first. */
  panelRef: RefObject<PanelHandle | null>;
  locked: boolean;
  /** Skip-intro affordance: OK skips while it is showing (§13). */
  intro?: { active: boolean; onSkip: () => void };
  /** Credits autoplay card: it handles its own OK / Back / left-right (§11). */
  credits?: { active: boolean; onKey: (key: RemoteKey) => boolean };
}

/**
 * The single window keydown router (§3, §15). D-pad keys (arrows / OK / Back,
 * from `@kroma/core` `resolveRemoteKey`) flow to the open panel first, then the
 * skip-intro / credits affordances, then the nav machine. On top, a few letter
 * shortcuts give web power users the classic transport (Space/k play, f
 * fullscreen, m mute, j/l seek) without clashing with the arrow-driven D-pad
 * model. One stable listener calls the latest closure.
 */
export function usePlayerKeys({
  nav,
  controller,
  flags,
  panelRef,
  locked,
  intro,
  credits,
}: PlayerKeysParams): void {
  const latest = useRef<(e: KeyboardEvent) => void>(() => undefined);
  latest.current = (e: KeyboardEvent) => {
    if (locked) {
      const k = resolveRemoteKey(e);
      if (k === 'Back' || k === 'Enter') {
        e.preventDefault();
        nav.handleKey('Back');
      }
      return;
    }

    // Letter / space transport shortcuts (web convenience, no arrow clash).
    const letter = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.code === 'Space' || letter === 'k') {
      e.preventDefault();
      nav.poke();
      controller.togglePlay();
      return;
    }
    if (letter === 'f' && flags.fullscreen) {
      nav.poke();
      controller.toggleFullscreen();
      return;
    }
    if (letter === 'm' && flags.volume) {
      nav.poke();
      controller.toggleMute();
      return;
    }
    if (letter === 'j') {
      nav.poke();
      controller.skip(-10);
      return;
    }
    if (letter === 'l') {
      nav.poke();
      controller.skip(10);
      return;
    }

    const remote = resolveRemoteKey(e);
    if (!remote) return;
    e.preventDefault();
    if (!nav.revealed) {
      nav.poke();
      return;
    }
    nav.poke();

    if (nav.overlay) {
      if (panelRef.current?.onKey(remote)) return;
      nav.handleKey(remote); // an unhandled Back closes the panel
      return;
    }
    if (intro?.active && remote === 'Enter') {
      intro.onSkip();
      return;
    }
    if (credits?.active && credits.onKey(remote)) return;
    nav.handleKey(remote);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => latest.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
