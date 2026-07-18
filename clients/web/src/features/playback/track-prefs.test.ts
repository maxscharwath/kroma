import { describe, expect, it } from 'vitest';
import type { AudioTrack } from '@kroma/core';
import type { SubtitleView } from '../../shared/lib/api';
import { matchesLang, preferredAudioIndex, preferredSubIndex } from './track-prefs';

const audio = (index: number, language: string | null): AudioTrack =>
  ({ index, codec: 'eac3', channels: 6, language, default: index === 0 }) as AudioTrack;

const sub = (
  index: number,
  language: string | null,
  over: Partial<SubtitleView> = {},
): SubtitleView =>
  ({ index, language, codec: 'subrip', url: `/s${index}.vtt`, ...over }) as SubtitleView;

describe('matchesLang', () => {
  it('matches ISO-639-2 aliases against their 2-letter base', () => {
    expect(matchesLang('fr', 'fra')).toBe(true);
    expect(matchesLang('fr', 'fre')).toBe(true);
    expect(matchesLang('en', 'eng')).toBe(true);
    expect(matchesLang('de', 'ger')).toBe(true);
    expect(matchesLang('de', 'deu')).toBe(true);
    expect(matchesLang('pt', 'por')).toBe(true);
  });

  it('matches identical 2-letter codes and is case-insensitive on the preference', () => {
    expect(matchesLang('en', 'en')).toBe(true);
    expect(matchesLang('EN', 'eng')).toBe(true);
  });

  it('does not match different languages or a missing code', () => {
    expect(matchesLang('fr', 'en')).toBe(false);
    expect(matchesLang('fr', null)).toBe(false);
    expect(matchesLang('fr', undefined)).toBe(false);
  });
});

describe('preferredAudioIndex', () => {
  const tracks = [audio(0, 'eng'), audio(1, 'fra'), audio(2, 'jpn')];

  it('returns the index of the track matching the preference', () => {
    expect(preferredAudioIndex(tracks, 'fr')).toBe(1);
    expect(preferredAudioIndex(tracks, 'en')).toBe(0);
    expect(preferredAudioIndex(tracks, 'ja')).toBe(2);
  });

  it('returns null when nothing matches or no preference is set', () => {
    expect(preferredAudioIndex(tracks, 'de')).toBeNull();
    expect(preferredAudioIndex(tracks, null)).toBeNull();
    expect(preferredAudioIndex(tracks, undefined)).toBeNull();
    expect(preferredAudioIndex([], 'en')).toBeNull();
  });
});

describe('preferredSubIndex', () => {
  const subs = [
    sub(0, 'eng'),
    sub(1, 'fra', { downloaded: true }), // AI-generated → never auto-picked
    sub(2, 'fra', { url: null }), // image sub (no url) → skipped
    sub(3, 'fra'), // the embedded fr track that should win
  ];

  it('auto-enables the first selectable embedded track for the preference', () => {
    expect(preferredSubIndex(subs, 'fr')).toBe(3);
    expect(preferredSubIndex(subs, 'en')).toBe(0);
  });

  it('never picks the "off" sentinel or an absent preference', () => {
    expect(preferredSubIndex(subs, 'off')).toBeNull();
    expect(preferredSubIndex(subs, null)).toBeNull();
    expect(preferredSubIndex(subs, undefined)).toBeNull();
  });

  it('returns null when no selectable embedded track matches', () => {
    expect(preferredSubIndex(subs, 'de')).toBeNull();
    // Only an AI track and a picture sub match here, so neither is auto-picked.
    expect(
      preferredSubIndex([sub(1, 'fra', { downloaded: true }), sub(2, 'fra', { url: null })], 'fr'),
    ).toBeNull();
  });
});
