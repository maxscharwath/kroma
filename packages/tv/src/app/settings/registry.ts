// Every shared user-facing setting, declared ONCE: identity, level, binding and
// presentation. Screens compose menus from these lists (plus screen-local
// actionItems built inline, e.g. the PIN row which needs auth + nav context).
//
// Adding a setting = one declaration here + one entry in a menu list. The row
// UI, the cycle logic, the platform gating and the cross-component reactivity
// all come from items.ts / store.ts / <SettingsRows>.

import { LANG_NO_PREF, LANG_OFF, LOCALES, langKey, type MessageKey, PREF_LANGS } from '@kroma/core';
import { useLocale, useSetLocale } from '@kroma/ui';
import { useEffect, useState } from 'react';
import { canQuitApp, quitApp } from '#tv/app/appQuit';
import { getGpuRendering, gpuToggleAvailable, setGpuRendering } from '#tv/app/desktopGpu';
import { availableEngines, ENGINE_LABEL_KEY, enginePrefStore } from '#tv/app/enginePref';
import {
  ALL_KEYBOARD_LAYOUTS,
  KEYBOARD_LAYOUT_LABEL_KEY,
  keyboardLayoutStore,
} from '#tv/app/keyboardLayoutPref';
import { prefValue, useLangPrefs } from '#tv/app/langPref';
import { actionItem, choiceItem, type SettingsItem, toggleItem } from './items';
import { perfHudPrefStore, useStoredPref } from './store';

/** Interface language. Account level: the I18nProvider owns the value and the
 * app persists + syncs a change to the signed-in account. */
export const localeSetting: SettingsItem = choiceItem({
  id: 'locale',
  level: 'account',
  label: 'common.language',
  icon: 'language',
  options: () => LOCALES.map((l) => l.code),
  // The find can't miss: options() only offers LOCALES codes.
  valueLabel: (code) => LOCALES.find((l) => l.code === code)?.labelKey ?? 'common.language',
  use: () => [useLocale(), useSetLocale()] as const,
});

/** Preferred audio language: the track a title opens on whenever the file
 * carries it. Account level, so it follows the viewer to the web and the phone.
 * The player's audio picker writes it too - choosing French once is the setting. */
export const audioLanguageSetting: SettingsItem = choiceItem({
  id: 'audioLanguage',
  level: 'account',
  label: 'account.audioLanguage',
  icon: 'volume',
  options: () => [LANG_NO_PREF, ...PREF_LANGS],
  valueLabel: langValueLabel,
  use: () => {
    const { audio, setAudio } = useLangPrefs();
    return [prefValue(audio), setAudio] as const;
  },
});

/** Preferred subtitle language, with an explicit "off" alongside the languages:
 * "never show subtitles" is a real preference, distinct from "no preference". */
export const subtitleLanguageSetting: SettingsItem = choiceItem({
  id: 'subtitleLanguage',
  level: 'account',
  label: 'account.subtitleLanguage',
  icon: 'badge-cc',
  options: () => [LANG_NO_PREF, LANG_OFF, ...PREF_LANGS],
  valueLabel: langValueLabel,
  use: () => {
    const { subtitle, setSubtitle } = useLangPrefs();
    return [prefValue(subtitle), setSubtitle] as const;
  },
});

/** Row label for a language preference value (a code, `none`, or `off`). */
function langValueLabel(value: string): MessageKey {
  if (value === LANG_OFF) return 'player.subtitlesOff';
  // The options only ever offer PREF_LANGS, which all have a catalog name.
  return langKey(value) ?? 'account.noPreference';
}

/** On-screen keyboard letter order (ABC / AZERTY / QWERTY / QWERTZ). */
export const keyboardLayoutSetting: SettingsItem = choiceItem({
  id: 'keyboardLayout',
  level: 'device',
  label: 'keyboardLayout.title',
  icon: 'keyboard',
  options: () => ALL_KEYBOARD_LAYOUTS,
  valueLabel: (v) => KEYBOARD_LAYOUT_LABEL_KEY[v],
  use: () => useStoredPref(keyboardLayoutStore),
});

/** Playback engine override. Hides itself on single-engine platforms (the
 * choice-row rule: fewer than two options = no row). */
export const engineSetting: SettingsItem = choiceItem({
  id: 'playbackEngine',
  level: 'device',
  label: 'playbackEngine.title',
  icon: 'movie',
  options: availableEngines,
  valueLabel: (v) => ENGINE_LABEL_KEY[v],
  use: () => useStoredPref(enginePrefStore),
});

/** Webview GPU renderer, Linux desktop shell only. Shell level: persisted in
 * the shell's config file and applied at boot, so flipping it relaunches. */
export const gpuRenderingSetting: SettingsItem = toggleItem({
  id: 'gpuRendering',
  level: 'shell',
  label: 'profileMenu.gpuRendering',
  icon: 'cpu',
  available: gpuToggleAvailable,
  use: () => {
    const [on, setOn] = useState(false);
    useEffect(() => {
      void getGpuRendering().then(setOn);
    }, []);
    const set = (next: boolean) => {
      setOn(next);
      void setGpuRendering(next); // persists, then relaunches the app
    };
    return [on, set] as const;
  },
});

/**
 * The performance read-out, on the screen it is about.
 *
 * A television is the only place these numbers mean anything and the hardest
 * place to attach a profiler, so the app carries its own: frame time, worst
 * frame, and press-to-focus. Left in the shipped build deliberately - the cost
 * when it is off is one boolean, and the alternative is guessing about a device
 * that is not on the desk.
 */
export const perfHudSetting: SettingsItem = toggleItem({
  id: 'perfHud',
  level: 'device',
  label: 'profileMenu.perfHud',
  icon: 'gauge',
  use: () => {
    const [on, set] = useStoredPref(perfHudPrefStore);
    return [on === 'on', (next: boolean) => set(next ? 'on' : 'off')] as const;
  },
});

/** Quit the app - desktop + Android TV shells (fullscreen, no window chrome). */
export const quitAppItem: SettingsItem = actionItem({
  id: 'quitApp',
  label: 'profileMenu.quitApp',
  icon: 'power',
  available: canQuitApp,
  run: quitApp,
});

/** The signed-out device-settings screen: everything a fresh install needs. */
export const DEVICE_SETTINGS: readonly SettingsItem[] = [
  localeSetting,
  keyboardLayoutSetting,
  gpuRenderingSetting,
  perfHudSetting,
  quitAppItem,
];

/** The settings block at the top of the signed-in profile menu. */
export const PROFILE_SETTINGS: readonly SettingsItem[] = [
  localeSetting,
  audioLanguageSetting,
  subtitleLanguageSetting,
  keyboardLayoutSetting,
  engineSetting,
  gpuRenderingSetting,
  perfHudSetting,
];
