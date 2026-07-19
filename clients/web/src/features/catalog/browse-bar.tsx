import { type GenreCount, type MessageKey, SORT_MODES, type SortMode } from '@kroma/core';
import { useT } from '@kroma/ui';
import type { ReactNode } from 'react';
import { Select } from '#web/shared/ui';

const SORT_LABEL_KEY: Record<SortMode, MessageKey> = {
  added: 'browse.sort.added',
  release: 'browse.sort.release',
  title: 'browse.sort.title',
  rating: 'browse.sort.rating',
};

export interface BrowseBarProps {
  sort: SortMode;
  onSort: (mode: SortMode) => void;
  /** Genres offered as filter chips (derived from the shown titles). */
  genres: GenreCount[];
  /** The active genre, or undefined for "All". */
  genre?: string;
  onGenre: (genre: string | undefined) => void;
}

/** The controls above a catalogue grid: a "Sort by" dropdown and a genre filter
 * chip row. Purely presentational the parent owns the state (URL search params),
 * so it stays shareable and survives a refresh. */
export function BrowseBar({ sort, onSort, genres, genre, onGenre }: Readonly<BrowseBarProps>) {
  const t = useT();
  return (
    <div className="mb-6 mt-5 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-semibold text-dim">{t('browse.sortBy')}</span>
        <Select
          ariaLabel={t('browse.sortBy')}
          value={sort}
          onChange={(v) => onSort(v as SortMode)}
          options={SORT_MODES.map((mode) => ({ value: mode, label: t(SORT_LABEL_KEY[mode]) }))}
        />
      </div>
      {genres.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <GenreChip active={!genre} onClick={() => onGenre(undefined)}>
            {t('browse.allGenres')}
          </GenreChip>
          {genres.map((g) => (
            <GenreChip key={g.name} active={g.name === genre} onClick={() => onGenre(g.name)}>
              {g.name}
            </GenreChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A clickable genre pill matching the shared `Chip` visual. */
function GenreChip({
  active,
  onClick,
  children,
}: Readonly<{ active: boolean; onClick: () => void; children: ReactNode }>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
        active ? 'bg-accent text-accent-ink' : 'bg-white/8 text-text hover:bg-white/12'
      }`}
    >
      {children}
    </button>
  );
}
