import { useCallback, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  View,
} from 'react-native';
import { gradient } from '../lib/css';
import { fonts } from '../lib/tokens';
import type { StoryboardTile } from '../storyboard';
import { Box } from '../ui/primitives/box';
import { Txt } from '../ui/primitives/text';
import { clamp01 } from './fmt';
import { StoryboardThumb } from './StoryboardThumb';
import type { Chapter } from './types';

export interface ChapterProgressBarProps {
  cur: number;
  dur: number;
  bufEnd: number;
  /** Pending scrub target while dragging / D-pad seeking (null when settled). */
  seekPreview: number | null;
  /** Normalized chapters; empty = one continuous segment (graceful fallback). */
  chapters: Chapter[];
  /** Storyboard thumbnail at a position (null until the sheet is ready). */
  tileAt: (sec: number) => StoryboardTile | null;
  /** The progress zone is the active D-pad focus (ring + always preview). */
  focused: boolean;
  /** Left label: elapsed time. */
  elapsed: string;
  /** Current chapter title, shown next to the elapsed time (empty to hide). */
  chapterLabel?: string;
  /** Right labels: total runtime + real end clock ("fin à 22h38"). */
  total: string;
  endsAt: string;
  /** Live scrub preview (absolute seconds) while dragging. */
  onScrub: (sec: number) => void;
  onScrubCommit: () => void;
}

/**
 * The chapter-aware progress bar (§1, §2), matching the 10-foot design: an info
 * row (elapsed . current-chapter on the left, runtime . end-clock on the right)
 * above a track of distinct chapter segments, each with its own amber played
 * fill + lighter buffered zone, a playhead pill, and the storyboard preview that
 * follows the cursor (mouse) or the position (D-pad). Pointer down-drag-up
 * previews then commits one seek click-to-point is the zero-length drag.
 */
/** Where the scrub preview's centre sits: on the cursor, clamped so the whole
 * thumbnail stays within the track. Falls back to the raw position before the
 * track has been measured. */
function previewCentre(
  previewSec: number | null,
  dur: number,
  trackWidth: number,
  half: number,
): number {
  if (previewSec == null || dur <= 0 || trackWidth <= 0) return 0;
  const centre = clamp01(previewSec / dur) * trackWidth;
  if (half * 2 >= trackWidth) return centre; // nothing to clamp into
  return Math.max(half, Math.min(trackWidth - half, centre));
}

export function ChapterProgressBar({
  cur,
  dur,
  bufEnd,
  seekPreview,
  chapters,
  tileAt,
  focused,
  elapsed,
  chapterLabel,
  total,
  endsAt,
  onScrub,
  onScrubCommit,
}: Readonly<ChapterProgressBarProps>) {
  // The track measures itself rather than reading a DOM rect, so the same drag
  // maths runs on a TV. React Native's responder system (through PanResponder)
  // is the one gesture API both renderers implement.
  const track = useRef({ x: 0, width: 0 });
  const dragging = useRef(false);
  const [hoverSec, setHoverSec] = useState<number | null>(null);
  // The track's width in state as well as in the ref: the ref serves the pointer
  // maths (read during a gesture, must not re-render), this serves the render
  // that has to keep the scrub preview on screen.
  const [trackWidth, setTrackWidth] = useState(0);

  const shown = seekPreview ?? cur;
  const shownPct = dur > 0 ? clamp01(shown / dur) * 100 : 0;

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    track.current = { x, width };
    setTrackWidth((prev) => (prev === width ? prev : width));
  }, []);

  const secAt = useCallback(
    (pageX: number): number | null => {
      const { x, width } = track.current;
      if (width <= 0 || dur <= 0) return null;
      return clamp01((pageX - x) / width) * dur;
    },
    [dur],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const sec = secAt(e.nativeEvent.locationX + track.current.x);
          if (sec == null) return;
          dragging.current = true;
          onScrub(sec);
          setHoverSec(sec);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          if (!dragging.current) return;
          const sec = secAt(e.nativeEvent.locationX + track.current.x);
          if (sec == null) return;
          onScrub(sec);
          setHoverSec(sec);
        },
        onPanResponderRelease: () => {
          if (!dragging.current) return;
          dragging.current = false;
          onScrubCommit();
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
        },
      }),
    [secAt, onScrub, onScrubCommit],
  );

  // Segments: real chapters, or a single implicit chapter over the whole runtime.
  const segs =
    chapters.length > 0
      ? chapters
      : [{ startMs: 0, endMs: dur * 1000, title: '', kind: 'chapter' as const }];
  const shownMs = shown * 1000;
  const bufMs = bufEnd * 1000;

  // Preview follows the cursor on hover, else the position while focused (D-pad).
  let previewSec: number | null = null;
  if (hoverSec != null) previewSec = hoverSec;
  else if (focused) previewSec = shown;
  const previewTile = previewSec != null ? tileAt(previewSec) : null;
  // Centred on the cursor, but kept inside the track: at 0:00 half the thumbnail
  // would hang off the left edge of the screen (and the last frames off the
  // right), which is exactly where a resume point or the credits put you.
  const previewHalf = (previewTile?.width ?? 0) / 2;
  const previewX = previewCentre(previewSec, dur, trackWidth, previewHalf);

  return (
    <Box mb={20}>
      {/* info row */}
      <Box row align="baseline" between mb={13}>
        <Txt style={TIME}>
          {elapsed}
          {chapterLabel ? (
            <Txt style={[TIME, MUTED]} color="rgba(244, 243, 240, 0.5)">{` · ${chapterLabel}`}</Txt>
          ) : null}
        </Txt>
        <Txt style={TIME} color="rgba(244, 243, 240, 0.5)">
          {total}
          {endsAt ? (
            <Txt style={[TIME, MUTED]} color="rgba(244, 243, 240, 0.38)">{` · ${endsAt}`}</Txt>
          ) : null}
        </Txt>
      </Box>

      {/* track */}
      <Box
        row
        align="center"
        gap={4}
        h={18}
        px={2}
        radius="pill"
        accessibilityRole="adjustable"
        accessibilityLabel="progress"
        accessibilityValue={{ min: 0, max: Math.round(dur), now: Math.round(shown) }}
        style={focused ? FOCUSED_TRACK : null}
      >
        {/* storyboard preview + timestamp */}
        {previewSec != null ? (
          <Box
            absolute
            bottom={36}
            left={previewX}
            z={6}
            align="center"
            gap={8}
            pointerEvents="none"
            style={{ transform: [{ translateX: -previewHalf }] }}
          >
            {previewTile ? <StoryboardThumb tile={previewTile} /> : null}
            <Box radius="md" bg="rgba(0, 0, 0, 0.8)" px={12} py={4}>
              <Txt style={STAMP}>{fmtSec(previewSec)}</Txt>
            </Box>
          </Box>
        ) : null}

        {/* segmented track */}
        <View
          onLayout={onTrackLayout}
          {...pan.panHandlers}
          style={{
            position: 'relative',
            flexDirection: 'row',
            alignItems: 'center',
            height: 6,
            flex: 1,
            gap: 4,
          }}
        >
          {segs.map((seg) => {
            const span = Math.max(1, seg.endMs - seg.startMs);
            const played = clamp01((shownMs - seg.startMs) / span);
            const buffed = clamp01((bufMs - seg.startMs) / span);
            return (
              <Box
                key={seg.startMs}
                flex
                h={6}
                radius="pill"
                overflow="hidden"
                bg="rgba(255, 255, 255, 0.2)"
              >
                <Box
                  fill
                  radius="pill"
                  bg="rgba(255, 255, 255, 0.28)"
                  right={`${(1 - buffed) * 100}%`}
                />
                <Box fill radius="pill" right={`${(1 - played) * 100}%`} style={gradient(PLAYED)} />
              </Box>
            );
          })}

          {/* playhead pill */}
          <Box
            absolute
            top="50%"
            left={`${shownPct}%`}
            w={16}
            h={16}
            radius="pill"
            bg="#FFFFFF"
            style={[PLAYHEAD, { transform: [{ translateX: -8 }, { translateY: -8 }] }]}
          />
        </View>
      </Box>
    </Box>
  );
}

const TIME = {
  fontFamily: fonts.ui,
  fontSize: 18,
  fontWeight: '600' as const,
  color: '#F4F3F0',
  fontVariant: ['tabular-nums' as const],
};
const MUTED = { fontWeight: '500' as const };
const FOCUSED_TRACK = { boxShadow: '0 0 0 4px rgba(242, 180, 66, 0.28)' };
const PLAYED = 'linear-gradient(90deg, #F4B642, #FFD262)';
const PLAYHEAD = {
  boxShadow: '0 0 0 4px rgba(242, 180, 66, 0.5), 0 2px 8px rgba(0, 0, 0, 0.6)',
};
const STAMP = {
  fontFamily: fonts.ui,
  fontSize: 14,
  fontWeight: '700' as const,
  color: '#FFFFFF',
  fontVariant: ['tabular-nums' as const],
};

/** Local mm:ss / h:mm:ss for the preview bubble (avoids importing to keep it terse). */
function fmtSec(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const hh = h > 0 ? `${h}:` : '';
  return `${hh}${mm}:${String(sec).padStart(2, '0')}`;
}
