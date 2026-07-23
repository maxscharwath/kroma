// One episode, as a row: still, number + title + runtime, recap underneath.
//
// Ported from the design source (`LUMA - TV.dc.html`, the episodes block of the
// série detail), values kept literal so a diff against the design stays legible:
// a 200pt still, 14pt padding, a 2.5% white card on a hairline border, 17pt
// title, and the recap at 14/1.5 in 60% ivory.
//
// The design draws these ONE to a line inside a 1000pt column, not two. That is
// not wasted space: the detail screen is a full-bleed backdrop, and the empty
// right-hand side is the artwork the page is built around. Two columns of cards
// covered it, which is what made the screen read like a table instead of a
// television.
//
// The watched toggle is the ONE addition to the design - the design has no way
// to mark a single episode seen, and that is the feature this screen was asked
// for. It is a real focus stop rather than a long-press on the row: a television
// remote has no discoverable long-press, and a hidden gesture is a feature
// nobody finds. Row and toggle share the line's horizontal region, so Left and
// Right move between them and Down goes to the next episode.

import { formatRuntime, type MediaItem, posterColors } from '@kroma/core';
import { useT } from '@kroma/ui';
import { Box, colors, Focusable, Icon, Img, radius, Txt, tintGradient } from '@kroma/ui/kit';

/** The still is drawn 200pt wide (design); served from the 320 bucket. */
export const EPISODE_W = 320;

/** One episode to a line, in a 1000pt column (design). */
export const EPISODE_COLUMNS = 1;
export const EPISODE_COLUMN_W = 1000;

const STILL_W = 200;
const TOGGLE = 44;

export function EpisodeRow({
  episode,
  still,
  watched,
  progress,
  onPlay,
  onToggleWatched,
  onFocus,
}: Readonly<{
  episode: MediaItem;
  /** Resolved still URL (the show's backdrop when the episode has none). */
  still: string | null;
  watched: boolean;
  /** Resume progress in percent, or null when the episode is untouched. */
  progress: number | null;
  onPlay: () => void;
  onToggleWatched: () => void;
  /** Fired when the row takes focus (grows the rendered window). */
  onFocus?: () => void;
}>) {
  const t = useT();
  const title = episode.episodeTitle ?? episode.title;
  const synopsis = episode.metadata?.overview;
  const runtime = formatRuntime(episode.durationMs);

  return (
    <Box row align="center" gap={12}>
      {/* The ROW is the focusable, so the amber ring wraps the card itself.
          Ringing an inner box drew a second rounded outline inside the card's
          own border - two nested rectangles for one control. */}
      <Focusable
        onPress={onPlay}
        onFocus={onFocus}
        label={title}
        style={[ROW, watched ? ROW_WATCHED : null]}
      >
        <Box row align="center" gap={20}>
          <Box
            w={STILL_W}
            aspect={16 / 9}
            center
            radius={10}
            overflow="hidden"
            bg="surface2"
            shrink={0}
          >
            <Img
              src={still}
              background={tintGradient(posterColors(episode.id))}
              position="50% 30%"
              fill
              style={watched ? DIMMED : undefined}
            />
            <Box w={44} h={44} center radius="pill" bg="rgba(10, 10, 12, 0.5)">
              <Icon name="player-play-filled" size={18} color="#FFFFFF" />
            </Box>
            {/* The design's own resume bar: a 4pt track with an amber fill. */}
            {progress != null && !watched ? (
              <Box absolute left={0} right={0} bottom={0} h={4} bg="rgba(255, 255, 255, 0.25)">
                <Box h={4} w={`${progress}%`} bg="accent" />
              </Box>
            ) : null}
          </Box>

          <Box flex={1}>
            <Box row align="center" gap={10} mb={6}>
              <Txt lines={1} style={TITLE}>
                {`${episode.episode}. ${title}`}
              </Txt>
              {runtime ? <Txt style={RUNTIME}>{runtime}</Txt> : null}
              {watched ? (
                <Txt style={STATUS_BADGE} color="accent">
                  {t('content.watched')}
                </Txt>
              ) : null}
            </Box>
            {synopsis ? (
              <Txt lines={2} style={SYNOPSIS}>
                {synopsis}
              </Txt>
            ) : null}
          </Box>
        </Box>
      </Focusable>

      <WatchedToggle
        watched={watched}
        onToggle={onToggleWatched}
        label={watched ? t('content.markUnwatched') : t('content.markWatched')}
      />
    </Box>
  );
}

/** The round mark-as-watched control, in the design's badge language: amber on
 * `accentSoft` once seen, a quiet outline until then. */
function WatchedToggle({
  watched,
  onToggle,
  label,
}: Readonly<{ watched: boolean; onToggle: () => void; label: string }>) {
  return (
    <Focusable onPress={onToggle} label={label} ring={false} focusScale={1.08} style={TOGGLE_BOX}>
      {({ focused }) => (
        <Box
          w={TOGGLE}
          h={TOGGLE}
          center
          radius="pill"
          bg={watched ? colors.accentSoft : 'rgba(255, 255, 255, 0.05)'}
          style={focused ? TOGGLE_RING : TOGGLE_IDLE}
        >
          <Icon
            name="check"
            size={19}
            stroke={2.4}
            color={watched ? colors.accent : 'rgba(244, 243, 240, 0.45)'}
          />
        </Box>
      )}
    </Focusable>
  );
}

/** The card. Design: `padding:14;border-radius:14;background:rgba(255,255,255,.025);
 * border:1px solid rgba(255,255,255,.05)`. */
const ROW = {
  flex: 1,
  minWidth: 0,
  padding: 14,
  borderRadius: 14,
  backgroundColor: 'rgba(255, 255, 255, 0.025)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.05)',
} as const;
const ROW_WATCHED = { borderColor: 'rgba(242, 180, 66, 0.22)' } as const;

const DIMMED = { opacity: 0.55 } as const;
const TOGGLE_BOX = { borderRadius: radius.pill, flexShrink: 0 } as const;
const TOGGLE_IDLE = { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' } as const;
const TOGGLE_RING = {
  borderWidth: 1,
  borderColor: colors.accent,
  boxShadow: '0 0 0 3px rgba(244, 182, 66, 0.45)',
} as const;

/** `font:700 17px` (design). */
const TITLE = { fontSize: 17, fontWeight: '700' as const, flexShrink: 1 };
/** `font:500 13px;color:rgba(244,243,240,.45)` (design). */
const RUNTIME = {
  fontSize: 13,
  fontWeight: '500' as const,
  color: 'rgba(244, 243, 240, 0.45)',
  fontVariant: ['tabular-nums' as const],
  flexShrink: 0,
};
/** The design's episode status pill, reused for the watched state. */
const STATUS_BADGE = {
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 0.4,
  textTransform: 'uppercase' as const,
  paddingVertical: 3,
  paddingHorizontal: 8,
  borderRadius: 5,
  backgroundColor: colors.accentSoft,
  overflow: 'hidden' as const,
  flexShrink: 0,
};
/** `font:400 14px/1.5;color:rgba(244,243,240,.6)` (design). */
const SYNOPSIS = {
  fontSize: 14,
  lineHeight: 21,
  fontWeight: '400' as const,
  color: 'rgba(244, 243, 240, 0.6)',
};
