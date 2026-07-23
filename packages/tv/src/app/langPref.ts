// The account's preferred audio and subtitle languages, on the TV.
//
// These live on the ACCOUNT, not the device: the preference follows the viewer
// to the phone and the web app (`PATCH /auth/me`), which is the whole point -
// "I watch in French" is a fact about the person, not about this television.
//
// Two writers share this hook: the settings rows in the profile menu, and the
// player itself. Picking a French audio track or a French subtitle in the
// Settings panel REMEMBERS that choice, so the next title starts in French
// without anyone visiting a settings screen. That is the behaviour a viewer
// expects and the reason the pickers do not just set player-local state.

import { LANG_NO_PREF, LANG_OFF, langBase } from '@kroma/core';
import { useCallback } from 'react';
import { useAuth } from '#tv/app/providers/auth';
import { useClient } from '#tv/app/router';

export interface LangPrefs {
  /** Preferred audio language (canonical code), or null for "no preference". */
  audio: string | null;
  /** Preferred subtitle language: a canonical code, `off`, or null. */
  subtitle: string | null;
  /** Persist a preferred audio language (`null` clears it). */
  setAudio: (code: string | null) => void;
  /** Persist a preferred subtitle language (`off` = keep them off, `null` clears). */
  setSubtitle: (code: string | null) => void;
}

/** Read + write the account's playback language preferences. Writes are
 * optimistic (the local user updates immediately) and best-effort on the wire:
 * a failed PATCH must never interrupt playback, and the next successful write
 * settles it. */
export function useLangPrefs(): LangPrefs {
  const { user, updateUser } = useAuth();
  const client = useClient();

  const audio = normalize(user?.audioLanguage);
  const subtitle = normalize(user?.subtitleLanguage);

  const save = useCallback(
    (patch: { audioLanguage?: string | null; subtitleLanguage?: string | null }) => {
      updateUser(patch);
      client.updateAccount(patch).catch(() => undefined);
    },
    [client, updateUser],
  );

  const setAudio = useCallback(
    (code: string | null) => {
      const next = normalize(code);
      if (next === audio) return;
      save({ audioLanguage: next });
    },
    [audio, save],
  );

  const setSubtitle = useCallback(
    (code: string | null) => {
      const next = normalize(code);
      if (next === subtitle) return;
      save({ subtitleLanguage: next });
    },
    [subtitle, save],
  );

  return { audio, subtitle, setAudio, setSubtitle };
}

/** Stored form of a preference: a canonical language code, the `off` sentinel,
 * or null (no preference). The `none` sentinel the pickers use is a UI value,
 * never a stored one. */
function normalize(code: string | null | undefined): string | null {
  if (!code || code === LANG_NO_PREF) return null;
  if (code === LANG_OFF) return LANG_OFF;
  return langBase(code);
}

/** The value a settings row shows for a stored preference (null → `none`). */
export function prefValue(stored: string | null): string {
  return stored ?? LANG_NO_PREF;
}
