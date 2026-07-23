// Language codes, normalized ONCE for the whole app.
//
// Track languages reach us from ffprobe, so they are whatever the muxer wrote:
// "fr", "fra", "fre", "fr-FR", "por"... The account carries ONE preferred audio
// language and ONE preferred subtitle language, and every client (web, TV,
// mobile) has to decide "is this the French track?" against that mess. Doing it
// per client is how "I chose French" ends up meaning French on one screen and
// the file's default on another - so the alias table, the matcher and the two
// track pickers live here, and nowhere else.

import type { MessageKey } from './i18n';

/** ISO 639-2/B and /T codes → the 639-1 code the catalog and the account use.
 * Bibliographic and terminological spellings both appear in the wild (`fre` on
 * a DVD rip, `fra` from a modern encoder), so both map to the same base. */
const ALIAS: Record<string, string> = {
  ara: 'ar',
  ces: 'cs',
  cze: 'cs',
  chi: 'zh',
  dan: 'da',
  deu: 'de',
  dut: 'nl',
  ell: 'el',
  eng: 'en',
  fin: 'fi',
  fra: 'fr',
  fre: 'fr',
  ger: 'de',
  gre: 'el',
  heb: 'he',
  hin: 'hi',
  hun: 'hu',
  ind: 'id',
  ita: 'it',
  jpn: 'ja',
  kor: 'ko',
  nld: 'nl',
  nor: 'no',
  pol: 'pl',
  por: 'pt',
  ron: 'ro',
  rum: 'ro',
  rus: 'ru',
  spa: 'es',
  swe: 'sv',
  tha: 'th',
  tur: 'tr',
  ukr: 'uk',
  vie: 'vi',
  zho: 'zh',
};

/**
 * Canonical base for a language code: `"eng"` → `"en"`, `"pt-BR"` → `"pt"`,
 * `"FRA"` → `"fr"`. Null when there is no code at all.
 *
 * An unknown three-letter code is returned UNCHANGED rather than truncated:
 * chopping `"swe"` to `"sw"` would silently claim Swedish is Swahili, and two
 * unknown codes that fail to match are far better than two that match wrongly.
 */
export function langBase(code?: string | null): string | null {
  if (!code) return null;
  const raw = code.trim().toLowerCase();
  if (!raw) return null;
  const base = raw.split(/[-_]/)[0] ?? raw;
  if (!base) return null;
  return ALIAS[base] ?? base;
}

/** Whether a track's language is the preferred one, both sides normalized. */
export function matchesLang(pref: string | null | undefined, code?: string | null): boolean {
  const a = langBase(pref);
  return a != null && a === langBase(code);
}

/** The languages a client offers as an audio/subtitle preference: the codes the
 * catalog has a native name for (see {@link langKey}). */
export const PREF_LANGS = [
  'en',
  'fr',
  'es',
  'de',
  'it',
  'pt',
  'nl',
  'ru',
  'ja',
  'ko',
  'zh',
] as const;

/** "No preference": keep the file's default track. Stored as `null` on the
 * account; this is the sentinel the pickers use, since a select needs a value. */
export const LANG_NO_PREF = 'none';

/** Subtitle preference sentinel: keep subtitles off, whatever the file offers. */
export const LANG_OFF = 'off';

/** Language code → the `lang.*` catalog key for its native name, or null when
 * the catalog has no name for it. Accepts any spelling {@link langBase} knows. */
export function langKey(code?: string | null): MessageKey | null {
  const base = langBase(code);
  return base && base in LANG_KEYS ? (LANG_KEYS[base] as MessageKey) : null;
}

const LANG_KEYS: Record<string, MessageKey> = {
  fr: 'lang.fr',
  en: 'lang.en',
  es: 'lang.es',
  de: 'lang.de',
  it: 'lang.it',
  ja: 'lang.ja',
  ko: 'lang.ko',
  zh: 'lang.zh',
  ru: 'lang.ru',
  pt: 'lang.pt',
  nl: 'lang.nl',
};

/** An audio track, as the preference matcher needs it. */
export interface AudioCandidate {
  /** Audio-relative stream index (what a player selects by). */
  index: number;
  language?: string | null;
}

/**
 * A subtitle track, as the preference matcher needs it. Clients map their own
 * shapes onto this (web `SubtitleView.downloaded`, TV `SubView.ai`) so the rule
 * "never auto-enable a generated track" is written once.
 */
export interface SubtitleCandidate {
  index: number;
  language?: string | null;
  /** The WebVTT url; absent/null = a picture sub we cannot render as text. */
  url?: string | null;
  /** AI-transcribed or translated. Selectable by hand, never auto-enabled. */
  generated?: boolean;
}

/** Index of the audio track matching `pref`, or null when none does (the caller
 * then keeps the file's own default). */
export function preferredAudioIndex(
  tracks: readonly AudioCandidate[],
  pref?: string | null,
): number | null {
  if (!pref || pref === LANG_NO_PREF) return null;
  const hit = tracks.find((tr) => matchesLang(pref, tr.language));
  return hit ? hit.index : null;
}

/** Index of the subtitle track to auto-enable for `pref`, or null (leave them
 * off). `off` and "no preference" both yield null; only renderable, non-
 * generated tracks are considered. */
export function preferredSubIndex(
  subs: readonly SubtitleCandidate[],
  pref?: string | null,
): number | null {
  if (!pref || pref === LANG_OFF || pref === LANG_NO_PREF) return null;
  const hit = subs.find((s) => Boolean(s.url) && !s.generated && matchesLang(pref, s.language));
  return hit ? hit.index : null;
}
