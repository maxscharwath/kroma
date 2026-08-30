import { Box } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { Img } from '#ui/components/atoms/img';
import { Text } from '#ui/components/atoms/text';
import { styles } from '#ui/core';
import { gradient } from '#ui/lib/css';
import { useT } from '#ui/services/i18n';

/**
 * The film offered once this one is over. Declared here rather than reusing
 * `UpNextItem` because a full-bleed hero wants what a card does not: art at
 * stage width, and a synopsis.
 */
export interface PostPlayItem {
  id: string;
  title: string;
  /** The line under the title: year, runtime, codec, already formatted. */
  subtitle?: string;
  /** Synopsis. Drawn in at most three lines. */
  overview?: string | null;
  /** Wide art, requested at {@link POST_PLAY_ART_W}. */
  artUrl?: string | null;
}

export type PostPlayFocus = 'play' | 'home';

export interface PostPlayProps {
  item: PostPlayItem;
  /** Which control wears the ring. The player's nav machine owns it, so both
   *  buttons are controlled and neither is a platform focus target. */
  focus: PostPlayFocus;
  /** The stage's width, which is what picks the type tier: this is a page
   *  rather than chrome, so it is typed for three metres or for a desk. */
  stageWidth: number;
  onPlay: () => void;
  onHome: () => void;
}

/** The width the hero is drawn at, and so the width to ask the server for. */
export const POST_PLAY_ART_W = 1920;

// A stage this wide is a television. Below it the same layout is typed for a
// desk, which is the only difference between the two.
const TV_STAGE = 1600;

const TIERS = {
  tv: {
    eyebrow: 'overlineTv',
    title: 'bannerTv',
    meta: 'labelTv',
    overview: 'bodyTv',
    button: 'tv',
    gutter: 80,
    foot: 72,
    copy: 900,
  },
  desk: {
    eyebrow: 'overline',
    title: 'h1',
    meta: 'label',
    overview: 'body',
    button: 'lg',
    gutter: 56,
    foot: 56,
    copy: 680,
  },
} as const;

const ART_FILL = 'linear-gradient(135deg, rgba(244,182,66,0.14), rgba(12,12,16,0.98))';
// The copy sits at the foot of the left half, so the art is darkened from that
// corner outwards rather than evenly: a flat scrim over a whole frame reads as
// a dimmed picture instead of a picture with something written on it.
const SCRIM = gradient(
  'linear-gradient(90deg, rgba(8,8,11,0.94) 0%, rgba(8,8,11,0.72) 42%, transparent 78%)',
);
const FLOOR = gradient(
  'linear-gradient(0deg, rgba(8,8,11,0.96) 0%, rgba(8,8,11,0.4) 34%, transparent 62%)',
);

/**
 * The end of a film (§10): a full screen offering the next one to watch, or the
 * way back to the home screen. It replaces the chrome rather than sitting over
 * it, and it is the only thing the remote can reach while it is up.
 */
export function PostPlay({ item, focus, stageWidth, onPlay, onHome }: Readonly<PostPlayProps>) {
  const t = useT();
  const tier = stageWidth >= TV_STAGE ? TIERS.tv : TIERS.desk;
  return (
    <Box fill z={50} bg="#08080b">
      <Img src={item.artUrl ?? null} background={ART_FILL} fill priority />
      <Box fill style={[s.inert, SCRIM]} />
      <Box fill style={[s.inert, FLOOR]} />
      <Box absolute left={tier.gutter} bottom={tier.foot} maxW={tier.copy}>
        <Text variant={tier.eyebrow} color="accentText" mb={12}>
          {t('player.upNextTitle')}
        </Text>
        <Text lines={2} variant={tier.title} mb={12}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text variant={tier.meta} color="text/72" mb={10}>
            {item.subtitle}
          </Text>
        ) : null}
        {item.overview ? (
          <Text lines={3} variant={tier.overview} color="text/64" mb={24}>
            {item.overview}
          </Text>
        ) : null}
        {/* Controlled kit buttons (`focus` is ALWAYS resolved to one of them) so
            neither becomes a platform focus target; see ../lib/virtual-focus. */}
        <Box row gap={14}>
          <Button
            variant="primary"
            size={tier.button}
            icon="player-play-filled"
            focused={focus === 'play'}
            onPress={onPlay}
            label={t('player.play')}
          />
          <Button
            variant="glass"
            size={tier.button}
            icon="home"
            focused={focus === 'home'}
            onPress={onHome}
            label={t('nav.home')}
          />
        </Box>
      </Box>
    </Box>
  );
}

const s = styles({
  inert: { pointerEvents: 'none' },
});
