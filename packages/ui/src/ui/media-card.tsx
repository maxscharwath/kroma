// <MediaCard>: the 16:9 landscape rail tile of the 10-foot home.
//
// Key art over a deterministic genre gradient, a legibility scrim, the optional
// watched check and resume bar, and the title block. Focusable, so it is a D-pad
// stop on a TV and a click target in a browser from the same source.

import { gradient } from '../lib/css';
import { fonts, radius } from '../lib/tokens';
import { Box } from './box';
import { Focusable } from './focusable';
import { Img } from './img';
import { Progress } from './progress';
import { Txt } from './text';
import { WatchedBadge } from './watched-badge';

/** Bottom-weighted scrim: the art stays visible while the title stays legible. */
const CARD_SCRIM = 'linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 40%, rgba(0, 0, 0, 0.75) 100%)';

/** The instant-visible fill behind artwork: a deterministic per-title gradient,
 * so a tile is never blank while the art loads and never blank if it fails. */
function tintGradient(tint: readonly [string, string]): string {
  return `linear-gradient(158deg, ${tint[0]} 0%, ${tint[1]} 72%)`;
}

interface MediaCardProps {
  title: string;
  /** Overline above the title (the genre, or an episode tag). */
  overline?: string;
  /** Landscape key art. Falls back to the `tint` gradient. */
  art: string | null;
  /** The two stops of the deterministic per-title gradient. */
  tint: readonly [string, string];
  /** Resume position, 0..1, or null for no bar. */
  progress?: number | null;
  watched?: boolean;
  width?: number;
  onPress?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
}

function MediaCard({
  title,
  overline,
  art,
  tint,
  progress = null,
  watched = false,
  width = 328,
  onPress,
  onFocus,
  autoFocus,
}: Readonly<MediaCardProps>) {
  return (
    <Focusable
      onPress={onPress}
      onFocus={onFocus}
      autoFocus={autoFocus}
      label={title}
      focusScale={1.06}
      style={{ width, flexShrink: 0, borderRadius: radius.xl }}
    >
      <Box w={width} aspect={16 / 9} radius="xl" overflow="hidden" bg="surface1" shadow="card">
        <Img src={art} background={tintGradient(tint)} position="50% 28%" fill />
        <Box fill style={gradient(CARD_SCRIM)} />
        {watched ? <WatchedBadge /> : null}
        <Box absolute left={18} right={18} bottom={16} gap={5}>
          {overline ? <Txt style={OVERLINE}>{overline}</Txt> : null}
          <Txt style={TITLE} lines={2}>
            {title}
          </Txt>
        </Box>
        {progress == null ? null : (
          <Box absolute left={0} right={0} bottom={0}>
            <Progress value={progress} />
          </Box>
        )}
      </Box>
    </Focusable>
  );
}

const OVERLINE = {
  fontFamily: fonts.ui,
  fontWeight: '700' as const,
  fontSize: 12,
  lineHeight: 14,
  letterSpacing: 1.2,
  textTransform: 'uppercase' as const,
  color: 'rgba(255, 255, 255, 0.65)',
};

const TITLE = {
  fontFamily: fonts.display,
  fontWeight: '700' as const,
  fontSize: 24,
  lineHeight: 25,
  color: '#FFFFFF',
};

export type { MediaCardProps };
export { CARD_SCRIM, MediaCard, tintGradient };
