import { useEffect } from 'react';
import { registerTvMediaKeys, resolveRemoteKey, type RemoteKey } from '@luma/core';

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-focus]')).filter(isVisible);
}

/** Geometric spatial navigation: move focus to the nearest element in `dir`. */
function moveFocus(dir: 'Up' | 'Down' | 'Left' | 'Right') {
  const els = focusables();
  if (els.length === 0) return;

  const active = document.activeElement as HTMLElement | null;
  const current = active && active.dataset.focus !== undefined ? active : els[0]!;
  const r = current.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of els) {
    if (el === current) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const dx = bx - cx;
    const dy = by - cy;

    let primary: number;
    let secondary: number;
    switch (dir) {
      case 'Left':
        if (dx >= -2) continue;
        primary = -dx;
        secondary = Math.abs(dy);
        break;
      case 'Right':
        if (dx <= 2) continue;
        primary = dx;
        secondary = Math.abs(dy);
        break;
      case 'Up':
        if (dy >= -2) continue;
        primary = -dy;
        secondary = Math.abs(dx);
        break;
      case 'Down':
        if (dy <= 2) continue;
        primary = dy;
        secondary = Math.abs(dx);
        break;
    }
    // Weight cross-axis drift heavily so we prefer straight-line neighbours.
    const score = primary + secondary * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
}

export interface FocusNavHandlers {
  onBack?: () => void;
  onPlayPause?: () => void;
  /** Re-run when this changes (e.g. view switch) to focus the first element. */
  resetKey?: unknown;
}

/**
 * Wires TV remote / keyboard input to spatial focus movement across any element
 * carrying a `data-focus` attribute (e.g. `<PosterCard focusable />`).
 */
export function useFocusNav({ onBack, onPlayPause, resetKey }: FocusNavHandlers) {
  useEffect(() => {
    registerTvMediaKeys();
    // Focus the first focusable on mount / view change.
    const first = focusables()[0];
    if (first && (!document.activeElement || (document.activeElement as HTMLElement).dataset?.focus === undefined)) {
      first.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      const key: RemoteKey | null = resolveRemoteKey(e);
      if (!key) return;
      // When a text field is focused, let it own ◀ ▶ (cursor) and OK (submit);
      // only ▲ ▼ leave the field. Otherwise typing a server URL is impossible.
      const active = document.activeElement;
      const inText = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      switch (key) {
        case 'Back':
          e.preventDefault();
          onBack?.();
          break;
        case 'Play':
        case 'Pause':
        case 'PlayPause':
          onPlayPause?.();
          break;
        case 'Enter': {
          if (inText) break; // native: submit the form / open the IME
          const el = active as HTMLElement | null;
          if (el && el.dataset.focus !== undefined) {
            // Always suppress the native <button> Enter activation so it can't
            // fire in addition to our click(). Crucially, ignore key-repeat: a
            // single held OK that opens a new view (e.g. a card → detail) must
            // NOT carry over and auto-activate the newly focused button (e.g.
            // detail → player). Only a fresh press activates.
            e.preventDefault();
            if (!e.repeat) el.click();
          }
          break;
        }
        case 'Left':
        case 'Right':
          if (inText) break; // native: move the text cursor
          e.preventDefault();
          moveFocus(key);
          break;
        case 'Up':
        case 'Down':
          e.preventDefault();
          moveFocus(key);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, onPlayPause, resetKey]);
}
