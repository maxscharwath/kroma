// <SplashBackdrop>: the sign-in screens' ambient artwork, one implementation
// for web, phone and TV: a slideshow of covers dissolving on a slow breathing
// zoom, graded dark enough to hold a form, with the KROMA wheel stacked
// across the lower frame as tilted glass ribbons. Purely decorative: it takes
// no input and hides itself from accessibility.
//
// Platform seams, in the NavPill tradition: the web keeps the photographic
// multiply grade, the saturation lift and the edge vignette (CSS-only
// effects); native approximates the grade with a plain wash. The ribbons
// frost through <Frost>, so they blur for real wherever the shell registered
// a blur view and degrade to a wash elsewhere.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Image as RNImage,
  type StyleProp,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Frost } from '#ui/components/atoms/frost';
import { Img } from '#ui/components/atoms/img';
import { Txt } from '#ui/components/atoms/text';
import { styles } from '#ui/core';

const WEB = Platform.OS === 'web';

// Ambience, not a carousel: each cover lingers, and the handover is a long
// dissolve rather than a cut.
const HOLD_MS = 18000;
const FADE_MS = 2800;
const BREATHE_MS = 20000;
const DRIFT_MS = 30000;

// The full KROMA wheel in wheel order, thinnest first into a broad base,
// like layered panes seen in perspective. Every step is smaller than the
// band above it, so the stack is one continuous overlap from its first
// ribbon to past the frame's bottom edge (the last band overshoots 100% to
// cover the wedge the tilt exposes). `drift` staggers the shared clock so
// the ribbons slide at different amplitudes.
const WHEEL_BANDS = [
  { color: 'rgba(242, 104, 92, .30)', top: '44%', height: '8%', drift: 1 },
  { color: 'rgba(244, 182, 66, .30)', top: '50%', height: '12%', drift: -0.7 },
  { color: 'rgba(95, 191, 143, .30)', top: '58%', height: '17%', drift: 0.5 },
  { color: 'rgba(79, 157, 224, .30)', top: '68%', height: '23%', drift: -1 },
  { color: 'rgba(99, 102, 241, .30)', top: '80%', height: '30%', drift: 0.8 },
  { color: 'rgba(168, 85, 247, .30)', top: '94%', height: '42%', drift: -0.4 },
] as const;

// A portrait phone is mostly HEIGHT: the desktop proportions bury the
// artwork under two thirds of ribbon, so compact screens take a tighter
// stack pinned to the lower quarter, same order and tilt.
const COMPACT_BANDS = [
  { color: 'rgba(242, 104, 92, .30)', top: '66%', height: '4%', drift: 1 },
  { color: 'rgba(244, 182, 66, .30)', top: '69%', height: '6%', drift: -0.7 },
  { color: 'rgba(95, 191, 143, .30)', top: '73%', height: '8%', drift: 0.5 },
  { color: 'rgba(79, 157, 224, .30)', top: '78%', height: '11%', drift: -1 },
  { color: 'rgba(99, 102, 241, .30)', top: '84%', height: '15%', drift: 0.8 },
  { color: 'rgba(168, 85, 247, .30)', top: '91%', height: '26%', drift: -0.4 },
] as const;

const COMPACT_MAX_W = 600;

interface SplashCover {
  /** Full artwork URL, already resolved against the server. */
  url: string;
  /** Corner caption, e.g. "Alien: Earth · 2025". */
  caption?: string;
  /** Small overline before the caption, e.g. the localized "Film". */
  eyebrow?: string;
}

interface SplashBackdropProps {
  covers: readonly SplashCover[];
  /** How long each cover holds before the next dissolve. */
  holdMs?: number;
  /** The stacked wheel ribbons; a host with a busy screen can turn them off. */
  bands?: boolean;
  style?: StyleProp<ViewStyle>;
}

function useLoop(duration: number): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const half = {
      duration,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: !WEB,
    } as const;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, ...half }),
        Animated.timing(value, { toValue: 0, ...half }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [value, duration]);
  return value;
}

function BandStack() {
  const clock = useLoop(DRIFT_MS);
  const { width } = useWindowDimensions();
  const bands = width > 0 && width < COMPACT_MAX_W ? COMPACT_BANDS : WHEEL_BANDS;
  return (
    <Box absolute style={s.stack}>
      {bands.map((band) => (
        <Animated.View
          key={band.color}
          style={[
            s.band,
            {
              top: band.top,
              height: band.height,
              backgroundColor: band.color,
              transform: [
                {
                  translateX: clock.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-34 * band.drift, 34 * band.drift],
                  }),
                },
              ],
            },
          ]}
        >
          <Frost amount={12} />
        </Animated.View>
      ))}
    </Box>
  );
}

/** The universal sign-in splash: hosts fetch `/api/splash`, map it to covers
 * and drop this behind their gate. It owns the rotation, the pre-decode of
 * the next cover, the grade that keeps a form readable, the ribbons and the
 * caption; the host owns everything interactive above it. */
function SplashBackdrop({
  covers,
  holdMs = HOLD_MS,
  bands = true,
  style,
}: Readonly<SplashBackdropProps>) {
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (covers.length < 2) return;
    const timer = setInterval(() => setSlide((n) => n + 1), holdMs);
    return () => clearInterval(timer);
  }, [covers.length, holdMs]);

  // Warm the next cover through the whole hold, so a dissolve never starts
  // against a half-loaded image.
  useEffect(() => {
    if (covers.length < 2) return;
    const next = covers[(slide + 1) % covers.length];
    if (!next) return;
    if (WEB) {
      const img = (globalThis as { document?: Document }).document?.createElement('img');
      if (img) {
        img.src = next.url;
        img.decode?.().catch(() => undefined);
      }
    } else {
      RNImage.prefetch(next.url).catch(() => undefined);
    }
  }, [slide, covers]);

  const breathe = useLoop(BREATHE_MS);
  const cover = covers[slide % Math.max(covers.length, 1)];
  if (!cover) return null;

  return (
    <Box
      absolute
      top={0}
      right={0}
      bottom={0}
      left={0}
      overflow="hidden"
      pointerEvents="none"
      aria-hidden
      style={[WEB ? (s.isolate as ViewStyle) : null, style]}
    >
      <Animated.View
        style={[
          s.fill,
          WEB ? (s.saturate as ViewStyle) : null,
          {
            transform: [
              { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
            ],
          },
        ]}
      >
        <Img src={cover.url} fill duration={FADE_MS} position="50% 30%" background="#101014" />
      </Animated.View>
      {/* The grade that keeps a centred form readable on ANY cover: multiply
          caps luminance while keeping hue on web; native takes a plain wash. */}
      {WEB ? (
        <Box absolute top={0} right={0} bottom={0} left={0} style={s.multiply as ViewStyle} />
      ) : null}
      {WEB ? null : <Box absolute top={0} right={0} bottom={0} left={0} bg="rgba(8, 8, 10, 0.5)" />}
      {bands ? <BandStack /> : null}
      {cover.caption ? (
        <Box absolute right={20} bottom={14} row align="center" gap={8}>
          {cover.eyebrow ? (
            <Txt variant="overline" color="white/40" style={s.eyebrow}>
              {cover.eyebrow}
            </Txt>
          ) : null}
          <Txt color="white/65" style={s.caption}>
            {cover.caption}
          </Txt>
        </Box>
      ) : null}
    </Box>
  );
}

const s = styles({
  fill: { absolute: true, top: 0, right: 0, bottom: 0, left: 0 },
  stack: { left: '-25%', right: '-25%', top: 0, bottom: 0, transform: [{ rotate: '-14deg' }] },
  band: {
    absolute: true,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  eyebrow: { fontSize: 10 },
  caption: { fontSize: 12, fontWeight: '500' },
  // Web-tier CSS reached through the style escape hatch, exactly like the
  // NavPill's lens: these keys are ignored by native.
  isolate: { isolation: 'isolate' },
  saturate: { filter: 'saturate(1.2)' },
  multiply: { backgroundColor: '#68686f', mixBlendMode: 'multiply' },
});

export type { SplashBackdropProps, SplashCover };
export { SplashBackdrop };
