// Ordering and filtering for the interactive-search results. Pure, because
// "why is this release above that one" is the question the admin is actually
// asking of the table.

import type { ScoredReleaseView } from '@kroma/core';
import type { ManualReleaseView } from './schemas';

export type ReleaseSort = 'score' | 'size' | 'seeders' | 'date';
export type ReleaseFilter = 'accepted' | 'rejected' | 'all';

export interface QualityFilter {
  resolutions: string[];
  codecs: string[];
  sources: string[];
  hdrOnly: boolean;
  minSeeders: number | null;
  maxSizeGb: number | null;
}

export const EMPTY_QUALITY_FILTER: QualityFilter = {
  resolutions: [],
  codecs: [],
  sources: [],
  hdrOnly: false,
  minSeeders: null,
  maxSizeGb: null,
};

export function filterReleases(
  releases: readonly ScoredReleaseView[],
  filter: ReleaseFilter,
  indexerId?: string | null,
  quality?: QualityFilter,
): ScoredReleaseView[] {
  let out = releases;
  if (filter !== 'all') {
    const accepted = filter === 'accepted';
    out = out.filter((r) => (r.score != null) === accepted);
  }
  if (indexerId) {
    out = out.filter((r) => r.indexerId === indexerId);
  }
  if (quality) {
    out = out.filter((r) => matchesQuality(r, quality));
  }
  return [...out];
}

function matchesQuality(r: ScoredReleaseView, q: QualityFilter): boolean {
  if (q.resolutions.length > 0 && !q.resolutions.includes(r.resolution ?? '')) return false;
  if (q.codecs.length > 0 && !q.codecs.includes(r.codec ?? '')) return false;
  if (q.sources.length > 0 && !q.sources.includes(r.source ?? '')) return false;
  if (q.hdrOnly && !r.hdr) return false;
  if (q.minSeeders != null && (r.seeders ?? 0) < q.minSeeders) return false;
  if (q.maxSizeGb != null && r.sizeBytes != null && r.sizeBytes > q.maxSizeGb * 1_000_000_000) {
    return false;
  }
  return true;
}

// A rejected release has no score, so it sorts last whatever the column: it is
// shown for the reason, not for its rank.
function rank(r: ScoredReleaseView, sort: ReleaseSort): number {
  switch (sort) {
    case 'score':
      return r.score ?? Number.NEGATIVE_INFINITY;
    case 'size':
      return r.sizeBytes ?? 0;
    case 'seeders':
      return r.seeders ?? 0;
    case 'date':
      return r.publishedAt ? Date.parse(r.publishedAt) || 0 : 0;
  }
}

export function sortReleases(
  releases: readonly ScoredReleaseView[],
  sort: ReleaseSort,
): ScoredReleaseView[] {
  return [...releases].sort((a, b) => {
    const rejected = Number(a.score == null) - Number(b.score == null);
    if (rejected !== 0) return rejected;
    return rank(b, sort) - rank(a, sort);
  });
}

/** `S03E07` / `S03 pack` / null for a movie: what this release would satisfy. */
export function targetLabel(r: ScoredReleaseView): string | null {
  if (r.target === 'movie') return null;
  const s = String(r.season ?? 0).padStart(2, '0');
  if (r.target === 'season') return `S${s}`;
  return `S${s}E${String(r.episodes?.[0] ?? 0).padStart(2, '0')}`;
}

// --- Free-text (manual) search sorting ---

export type ManualSort = 'seeders' | 'size' | 'date';

export function filterManualReleases(
  releases: readonly ManualReleaseView[],
  indexerId?: string | null,
  quality?: QualityFilter,
): ManualReleaseView[] {
  let out = releases;
  if (indexerId) {
    out = out.filter((r) => r.indexerId === indexerId);
  }
  if (quality) {
    out = out.filter((r) => matchesManualQuality(r, quality));
  }
  return [...out];
}

function matchesManualQuality(r: ManualReleaseView, q: QualityFilter): boolean {
  if (q.resolutions.length > 0 && !q.resolutions.includes(r.resolution ?? '')) return false;
  if (q.codecs.length > 0 && !q.codecs.includes(r.codec ?? '')) return false;
  if (q.sources.length > 0 && !q.sources.includes(r.source ?? '')) return false;
  if (q.minSeeders != null && (r.seeders ?? 0) < q.minSeeders) return false;
  if (q.maxSizeGb != null && r.sizeBytes != null && r.sizeBytes > q.maxSizeGb * 1_000_000_000) {
    return false;
  }
  return true;
}

export function sortManualReleases(
  releases: readonly ManualReleaseView[],
  sort: ManualSort,
): ManualReleaseView[] {
  return [...releases].sort((a, b) => manualRank(b, sort) - manualRank(a, sort));
}

function manualRank(r: ManualReleaseView, sort: ManualSort): number {
  switch (sort) {
    case 'size':
      return r.sizeBytes ?? 0;
    case 'seeders':
      return r.seeders ?? 0;
    case 'date':
      return r.publishedAt ? Date.parse(r.publishedAt) || 0 : 0;
  }
}
