// What the torrent turns out to hold, read from its own file list.
//
// A release name is a claim; the files are the fact. "Stargate.Atlantis.
// INTEGRALE" says nothing about how many seasons are in it, and a magnet named
// after a movie can carry a season pack. Analysing first means the flow already
// knows what it is looking at, so it never asks an operator to type a season
// number that is written in the files.

import type { TorrentAnalysis, TorrentFileView } from '@kroma/module-acquisition/schemas';
import type { Kind } from './manual-grab-target';

/** What the contents say the grab is for. */
export interface DetectedContent {
  kind: Kind;
  season: string;
  episode: string;
  /** Seasons present, for the summary line. */
  seasons: number[];
  episodeCount: number;
  /** True when the files settled it, rather than the release name guessing. */
  certain: boolean;
}

const videoFiles = (analysis: TorrentAnalysis): TorrentFileView[] =>
  analysis.files.filter((f) => f.isVideo);

const episodeFiles = (analysis: TorrentAnalysis): TorrentFileView[] =>
  videoFiles(analysis).filter((f) => f.episode !== null);

/**
 * Read an analysed torrent into the shape the add needs.
 *
 * `unknown` means no video the classifier recognised, which is not a fact worth
 * overriding a parsed name with, so it reports uncertain and the caller keeps
 * whatever the release name said.
 */
export function detect(analysis: TorrentAnalysis): DetectedContent {
  const episodes = episodeFiles(analysis);
  const first = episodes[0];
  const base = {
    seasons: analysis.seasons,
    episodeCount: episodes.length,
    certain: analysis.kind !== 'unknown',
  };
  switch (analysis.kind) {
    case 'episode':
      return {
        ...base,
        kind: 'episode',
        season: first?.season != null ? String(first.season) : '',
        episode: first?.episode != null ? String(first.episode) : '',
      };
    case 'season':
    case 'series':
      return {
        ...base,
        kind: 'season',
        // A multi-season pack has no single season to name; the files carry
        // their own, and the import reads them per file.
        season: analysis.seasons.length === 1 ? String(analysis.seasons[0]) : '',
        episode: '',
      };
    case 'movie':
      return { ...base, kind: 'movie', season: '', episode: '' };
    default:
      return { ...base, kind: 'movie', season: '', episode: '' };
  }
}

/** The one-line summary of what was found, as message-key arguments. */
export function summaryOf(found: DetectedContent): {
  key: 'movie' | 'episode' | 'season' | 'series';
  vars: Record<string, string>;
} {
  if (found.kind === 'movie') return { key: 'movie', vars: {} };
  if (found.kind === 'episode') {
    return { key: 'episode', vars: { season: found.season, episode: found.episode } };
  }
  if (found.seasons.length > 1) {
    return {
      key: 'series',
      vars: { seasons: String(found.seasons.length), episodes: String(found.episodeCount) },
    };
  }
  return {
    key: 'season',
    vars: { season: found.season || '?', episodes: String(found.episodeCount) },
  };
}
