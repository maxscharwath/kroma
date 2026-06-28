import { channelLabel, langCode, type MediaItem } from '@luma/core';
import { CheckGlyph } from '#tv/player/icons';
import type { SubView } from '#tv/player/useSubtitleSelection';

const TRACK = 'flex items-center gap-3.5 rounded-xl border border-transparent px-4 py-3.5';
const CODE = 'min-w-9 rounded-md bg-[rgba(255,255,255,0.08)] py-[5px] text-center font-sans text-[12px] font-bold text-[rgba(244,243,240,0.85)]';
const LABEL = 'mb-3 mt-[22px] font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-dim';

/** Right-side Audio & Sous-titres drawer. The audio track is informational (one
 * track per direct-play item); subtitles are the selectable list. */
export function AvPanel({
  item,
  rendered,
  options,
  active,
  focus,
}: {
  item: MediaItem;
  rendered: SubView[];
  options: (number | null)[];
  active: number | null;
  focus: number;
}) {
  return (
    <div className="absolute inset-y-0 right-0 w-[400px] overflow-y-auto border-l border-border bg-[rgba(16,16,20,0.92)] px-7 py-[30px] backdrop-blur-[24px]">
      <div className="mb-[26px] font-display text-[22px] font-bold">Audio &amp; Sous-titres</div>

      <div className={LABEL}>Piste audio</div>
      <div className={`${TRACK} bg-[rgba(255,255,255,0.04)] opacity-85`}>
        <span className={CODE}>{langCode(item.audio?.language ?? null)}</span>
        <span className="flex-1 font-sans text-[15px] font-semibold text-text">
          {item.audio?.codec ? item.audio.codec.toUpperCase() : 'Audio'}
          {channelLabel(item.audio?.channels) ? ` · ${channelLabel(item.audio?.channels)}` : ''}
        </span>
        <CheckGlyph />
      </div>

      <div className={LABEL}>Sous-titres</div>
      <div className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const sv = opt == null ? null : rendered.find((s) => s.index === opt) ?? null;
          return (
            <div
              key={opt ?? 'off'}
              className={`${TRACK} ${focus === i ? 'bg-[rgba(255,255,255,0.1)] shadow-[var(--ring-focus-sm)]' : 'bg-[rgba(255,255,255,0.04)]'}`}
            >
              <span className={CODE}>{opt == null ? '—' : langCode(sv?.language ?? null)}</span>
              <span className="flex-1 font-sans text-[15px] font-semibold text-text">
                {opt == null ? 'Désactivés' : sv?.language ? sv.language.toUpperCase() : `Piste ${opt + 1}`}
              </span>
              {active === opt ? <CheckGlyph /> : null}
            </div>
          );
        })}
        {rendered.length === 0 ? (
          <div className="px-1 py-2 font-sans text-[14px] font-medium text-dim">Aucun sous-titre texte disponible</div>
        ) : null}
      </div>
    </div>
  );
}
