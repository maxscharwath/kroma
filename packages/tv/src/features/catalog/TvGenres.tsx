import { collectGenres } from '@kroma/core';
import { useT } from '@kroma/ui';
import { useMemo } from 'react';
import { useConnection } from '#tv/app/providers/connection';
import { useNav } from '#tv/app/router';
import { useFocusNav } from '#tv/app/useFocusNav';
import { TvTopNav } from '#tv/features/catalog/home/TopNav';

/** Genre picker: every genre in the library (movies + shows), most common first.
 * Selecting one drills into {@link TvGenreGrid}. Derives the genre list from the
 * already-loaded catalogue no extra request, like {@link TvPerson}. */
export function TvGenres() {
  const { movies, shows } = useConnection();
  const t = useT();
  const nav = useNav();
  useFocusNav({ onBack: nav.back });

  const genres = useMemo(() => collectGenres([...movies, ...shows]), [movies, shows]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg animate-[tv-fade-in_0.3s_ease]">
      <header className="px-16 pb-6 pt-28">
        <h1 className="m-0 font-display text-[clamp(34px,5.5vh,60px)] font-bold leading-[0.98] tracking-[-0.02em]">
          {t('nav.genres')}
        </h1>
      </header>

      {genres.length ? (
        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-16 pb-18">
          <div className="flex flex-wrap gap-4">
            {genres.map((g) => (
              <button
                key={g.name}
                type="button"
                data-focus=""
                onClick={() => nav.go('genre', { name: g.name })}
                className="flex w-[280px] cursor-pointer flex-col gap-1 rounded-2xl border border-border bg-surface-2 px-6 py-5 text-left outline-none transition-transform focus:scale-[1.04] focus:border-accent"
              >
                <span className="font-display text-[22px] font-bold text-text">{g.name}</span>
                <span className="font-sans text-[15px] font-semibold text-muted tabular-nums">
                  {t('person.titleCount', { count: g.count })}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-16">
          <p className="max-w-160 text-center font-sans text-[18px] font-medium text-dim">
            {t('genres.empty')}
          </p>
        </div>
      )}

      {/* Persistent nav last in DOM so a genre tile keeps the initial focus. */}
      <TvTopNav active="genres" />
    </div>
  );
}
