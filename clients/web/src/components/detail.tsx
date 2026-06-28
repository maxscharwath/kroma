import { useEffect, useState } from 'react';
import {
  canDirectPlay,
  channelLabel,
  codecLabel,
  posterColors,
  type CastMember,
  type MediaItem,
  type VideoTrack,
} from '@luma/core';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Poster, Rail } from '#web/components/ui';
import { imageUrl } from '#web/lib/api';

export type QualityTone = '4K' | 'HDR' | 'H.265';

/** Quality pills shown beside the meta line (mirrors the design's `cur.badges`). */
export function qualityBadges(video: VideoTrack | null | undefined): QualityTone[] {
  if (!video) return [];
  const out: QualityTone[] = [];
  if ((video.width ?? 0) >= 3840) out.push('4K');
  if (video.hdr) out.push('HDR');
  if (video.codec === 'hevc') out.push('H.265');
  return out;
}

const LANG_NAMES: Record<string, string> = {
  fr: 'Français', fra: 'Français', fre: 'Français',
  en: 'Anglais', eng: 'Anglais',
  es: 'Espagnol', spa: 'Espagnol',
  de: 'Allemand', ger: 'Allemand', deu: 'Allemand',
  it: 'Italien', ita: 'Italien',
  ja: 'Japonais', jpn: 'Japonais',
  ko: 'Coréen', kor: 'Coréen',
  zh: 'Chinois', zho: 'Chinois', chi: 'Chinois',
  ru: 'Russe', rus: 'Russe',
  pt: 'Portugais', por: 'Portugais',
  nl: 'Néerlandais', dut: 'Néerlandais', nld: 'Néerlandais',
};

export function langName(code: string | null | undefined): string | null {
  if (!code) return null;
  return LANG_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

/** "Français · AAC 5.1" — language then codec/channels. */
export function audioString(item: Pick<MediaItem, 'audio'>): string {
  const a = item.audio;
  if (!a) return '—';
  const tech = [codecLabel(a.codec), channelLabel(a.channels)].filter(Boolean).join(' ');
  return [langName(a.language), tech].filter(Boolean).join(' · ') || '—';
}

/** Distinct subtitle languages, or "Aucun". */
export function subString(item: Pick<MediaItem, 'subtitles'>): string {
  const langs = [...new Set(item.subtitles.map((s) => langName(s.language)).filter(Boolean))];
  return langs.length ? langs.join(', ') : 'Aucun';
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4v16l13-8z" />
    </svg>
  );
}

function Field({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <div className="mb-[7px] text-[11px] font-semibold uppercase tracking-[.1em] text-white/45">{label}</div>
      <div className="text-[14px] font-medium text-white/85">{value}</div>
    </div>
  );
}

export interface DetailHeroProps {
  /** Identity + artwork for the key-art backdrop and poster. */
  art: { id: string; backdrop: string | null; poster: string };
  /** Amber overline above the title (e.g. genres, or "Série · 2 saisons"). */
  overline: string;
  title: string;
  rating?: number | null;
  /** Terse meta line, e.g. "2024 · 2h08 · Français". */
  meta: string;
  badges: QualityTone[];
  tagline?: string | null;
  overview?: string | null;
  audio: string;
  subtitles: string;
  playLabel?: string;
  onBack: () => void;
  onPlay: () => void;
  /** Item whose codecs gate direct-play; the warning is computed client-side. */
  playable?: MediaItem | null;
}

/** Full-bleed cinematic detail hero shared by the movie and series fiches
 * (matches the web DETAIL section of LUMA.dc.html). */
export function DetailHero({
  art,
  overline,
  title,
  rating,
  meta,
  badges,
  tagline,
  overview,
  audio,
  subtitles,
  playLabel = 'Lecture',
  onBack,
  onPlay,
  playable,
}: Readonly<DetailHeroProps>) {
  const [c1, c2] = posterColors(art.id);
  const heroBg = art.backdrop ? `url("${art.backdrop}")` : `linear-gradient(135deg, ${c1}, ${c2})`;

  // Direct-play depends on the runtime's codecs (navigator/MediaSource), so it
  // must stay client-only — computing it during SSR would mismatch on hydration.
  const [unsupported, setUnsupported] = useState<string | null>(null);
  useEffect(() => {
    if (!playable) return setUnsupported(null);
    const v = canDirectPlay(playable);
    setUnsupported(v.canDirectPlay ? null : v.reason);
  }, [playable]);

  return (
    <div className="relative min-h-[62vh]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: heroBg }} />
      <div className="absolute inset-0 bg-[radial-gradient(130%_110%_at_75%_20%,transparent_28%,var(--luma-bg)_80%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--luma-bg)_2%,transparent_46%)]" />

      <button
        type="button"
        onClick={onBack}
        aria-label="Retour"
        className="absolute left-8 top-[26px] z-[3] flex h-[42px] w-[42px] items-center justify-center rounded-full
          border border-white/[.12] bg-[rgba(10,10,12,.5)] backdrop-blur-[8px] transition-colors hover:bg-[rgba(10,10,12,.8)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      <div className="relative flex flex-wrap items-end gap-10 px-[var(--gutter-web)] pb-9 pt-[90px]">
        <div
          className="relative aspect-[2/3] w-60 shrink-0 overflow-hidden rounded-[14px] shadow-hero"
          style={{ background: `linear-gradient(158deg, ${c1}, ${c2})` }}
        >
          <img src={art.poster} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        </div>

        <div className="max-w-[680px] flex-1">
          <div className="mb-3 text-[12px] font-semibold tracking-[.18em] text-accent">{overline}</div>
          <h1 className="mb-4 font-display text-[56px] font-bold leading-none tracking-[-.02em]">{title}</h1>

          <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
            {rating ? (
              <>
                <span className="text-[14px] font-bold text-accent">{rating.toFixed(1)}★</span>
                <span className="text-white/40">·</span>
              </>
            ) : null}
            <span className="text-[14px] font-medium text-white/[.72]">{meta}</span>
            {badges.map((b) => (
              <Badge key={b} tone={b}>
                {b}
              </Badge>
            ))}
          </div>

          {tagline ? <p className="mb-3 text-[14px] italic text-white/50">{tagline}</p> : null}
          {overview ? <p className="mb-[22px] text-[16px] leading-[1.6] text-white/[.82]">{overview}</p> : null}

          <div className="mb-[26px] flex flex-wrap items-center gap-3.5">
            <Button onClick={onPlay} icon={<PlayIcon />}>
              {playLabel}
            </Button>
            <button
              type="button"
              aria-label="Ajouter à ma liste"
              title="Ma liste — bientôt"
              className="flex h-[50px] w-[50px] items-center justify-center rounded-md border border-border-strong
                bg-white/10 text-text transition-colors hover:bg-white/15"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          <div className="flex flex-wrap gap-x-11 gap-y-4 border-t border-white/[.08] py-[18px]">
            <Field label="Audio" value={audio} />
            <Field label="Sous-titres" value={subtitles} />
          </div>
          {unsupported ? <p className="mt-3.5 text-[13px] text-muted">{unsupported}</p> : null}
        </div>
      </div>
    </div>
  );
}

export interface SimilarItem {
  id: string;
  title: string;
  genre: string;
  badge: string | null;
  poster: string;
}

/** First + last initials, e.g. "George MacKay" → "GM". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** "Distribution" — horizontal rail of initials avatars (matches the design;
 * the reference uses gradient initials, not photos). */
export function CastRail({ cast }: Readonly<{ cast: CastMember[] }>) {
  if (cast.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-[18px] px-[var(--gutter-web)] font-display text-[22px] font-bold tracking-[-.02em]">
        Distribution
      </h2>
      <Rail gap={22} padded label="Distribution">
        {cast.map((p, i) => {
          const [g1, g2] = posterColors(p.name);
          const photo = imageUrl(p.profileUrl);
          return (
            <div key={`${p.name}-${i}`} className="w-28 shrink-0 text-center">
              <Avatar className="mb-[11px] h-28 w-28 rounded-full shadow-[0_8px_22px_rgba(0,0,0,.45)]">
                {photo ? <AvatarImage src={photo} alt={p.name} loading="lazy" decoding="async" draggable={false} /> : null}
                <AvatarFallback
                  className="font-display text-[36px] font-bold text-white/90"
                  style={{ background: `linear-gradient(158deg, ${g1}, ${g2})` }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_22%,rgba(255,255,255,.2),transparent_60%)]" />
                  <span className="relative">{initials(p.name)}</span>
                </AvatarFallback>
              </Avatar>
              <div className="truncate text-[14px] font-semibold">{p.name}</div>
              {p.character ? <div className="truncate text-[12px] font-medium text-white/45">{p.character}</div> : null}
            </div>
          );
        })}
      </Rail>
    </section>
  );
}

/** Horizontal "Titres similaires" rail of poster tiles. */
export function SimilarRail({
  title,
  items,
  onOpen,
}: Readonly<{ title: string; items: SimilarItem[]; onOpen: (id: string) => void }>) {
  if (items.length === 0) return null;
  return (
    <section className="mt-11">
      <h2 className="mb-4 px-[var(--gutter-web)] font-display text-[22px] font-bold tracking-[-.02em]">{title}</h2>
      <Rail gap={18} padded label={title}>
        {items.map((m) => (
          <Poster
            key={m.id}
            title={m.title}
            genre={m.genre}
            badge={m.badge}
            colors={posterColors(m.id)}
            poster={m.poster}
            width={200}
            onClick={() => onOpen(m.id)}
          />
        ))}
      </Rail>
    </section>
  );
}
