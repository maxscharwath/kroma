// Native (Apple TV / Android TV) brand intro, played via expo-video. No CSS
// fallback: unlike the browser shells, a native TV always has an HEVC decoder.
// See BrandIntro.web.tsx for the browser half.

import { colors, holdInput } from '@kroma/ui/kit';
import { EXIT_MS, SAFETY_SLACK_MS } from '@kroma/ui/kit/organisms/kroma-intro';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, type HWEvent, StyleSheet, useTVEventHandler, View } from 'react-native';

export interface BrandIntroProps {
  videoSrc?: string;
}

// `require`, not an import: Metro turns the asset into a registry entry, which
// is what expo-video expects as a source.
const FILM: number = require('@kroma/ui/src/assets/kroma-intro-hevc.mp4');

// Fallback hold time, used only until the player reports the film's real
// duration.
const SAFETY_MS = 15_000;
const AUDIO_FADE_STEPS = 8;

// The four directions are deliberately excluded: an arrow during the intro is
// a hand finding the remote, not a request to navigate a screen it can't see.
const SKIP_EVENTS = new Set(['select', 'longSelect', 'playPause', 'play', 'pause', 'menu', 'back']);

// Module scope, not React state: the intro must play once per launch, not once
// per mount (a fast refresh must not replay it), and outlives every remount.
let introSeen = false;

// `useTVEventHandler` exists only on the tvOS RN fork; bound once at module
// scope so the hook count never changes between builds.
const HAS_TV_EVENTS = typeof useTVEventHandler === 'function';
const useRemoteEvents: (handler: (event: HWEvent) => void) => void = HAS_TV_EVENTS
  ? useTVEventHandler
  : () => {};

export function BrandIntro({ videoSrc }: Readonly<BrandIntroProps>) {
  const [done, setDone] = useState(introSeen);
  const finish = useCallback(() => {
    introSeen = true;
    setDone(true);
  }, []);
  if (done) return null;
  return <IntroFilm source={videoSrc ?? FILM} onDone={finish} />;
}

/** The film itself, mounted only while it plays: unmounting is what releases the
 * player, so the app behind it never shares a decoder with an intro that ended. */
function IntroFilm({ source, onDone }: Readonly<{ source: string | number; onDone: () => void }>) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  const veil = useRef(new Animated.Value(0)).current;
  const exited = useRef(false);
  const safety = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handoff = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audioFade = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // Read through a ref so the effects below never have to re-run (which would
  // restart the film) when the prop identity changes.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  /**
   * End the intro: fade to black, then hand off to the app. Runs at most once,
   * whichever of the three ends it (the film's own end, a skip, the safety).
   *
   * The hand-off is a timer rather than the animation's completion callback, for
   * the same reason the web half uses one: an interrupted animation drops its
   * callback and would strand the app behind a black screen, and the one thing
   * an intro must never do is fail to end.
   */
  const exit = useCallback(() => {
    if (exited.current) return;
    exited.current = true;
    clearTimeout(safety.current);

    // The film keeps playing under the veil, as it does on the web. But its
    // sound has to leave with the picture, and a hardware player has no CSS to
    // fade, so the volume is ramped down across the same 850 ms.
    let step = 0;
    audioFade.current = setInterval(() => {
      step += 1;
      try {
        player.volume = Math.max(0, 1 - step / AUDIO_FADE_STEPS);
      } catch {
        // The player is already gone; there is nothing left to quieten.
      }
      if (step >= AUDIO_FADE_STEPS) clearInterval(audioFade.current);
    }, EXIT_MS / AUDIO_FADE_STEPS);

    Animated.timing(veil, { toValue: 1, duration: EXIT_MS, useNativeDriver: true }).start();
    handoff.current = setTimeout(() => onDoneRef.current(), EXIT_MS);
  }, [player, veil]);

  /** (Re-)arm the stall safety, from the film's real length once it has one. */
  const armSafety = useCallback(
    (durationSec?: number) => {
      clearTimeout(safety.current);
      const ms =
        durationSec && Number.isFinite(durationSec) && durationSec > 0
          ? durationSec * 1000 + SAFETY_SLACK_MS
          : SAFETY_MS;
      safety.current = setTimeout(exit, ms);
    },
    [exit],
  );

  // The film's own events. An error is not a fallback here (see the header): a
  // native TV that cannot open this file is a TV that gets the app straight away.
  useEffect(() => {
    const subscriptions = [
      player.addListener('playToEnd', exit),
      player.addListener('statusChange', ({ status, error }) => {
        if (status === 'error') {
          // Loud, because the failure is otherwise INVISIBLE: the app just
          // appears without an intro, which reads as "the port never shipped".
          // The usual cause is a stale build whose bundled assets predate the
          // film (`console.warn` reaches os_log; `console.log` does not).
          console.warn('[KROMA] brand intro could not play, skipping:', error?.message ?? status);
          exit();
        } else if (status === 'readyToPlay') armSafety(player.duration);
      }),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.remove();
    };
  }, [player, exit, armSafety]);

  // Take the remote for the length of the intro, and arm the safety with the
  // fallback length until the player knows better.
  useEffect(() => {
    armSafety();
    const release = holdInput();
    return () => {
      release();
      clearTimeout(safety.current);
      clearTimeout(handoff.current);
      clearInterval(audioFade.current);
    };
  }, [armSafety]);

  useRemoteEvents((event: HWEvent) => {
    // No key-up filter: Android reports a press twice and `exit` is single-shot,
    // so the second half is already a no-op.
    if (SKIP_EVENTS.has(event.eventType)) exit();
  });

  return (
    // Not `box-none`: a touch on the intro belongs to the intro, and would
    // otherwise land on the app underneath.
    <View style={styles.stage}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        // The intro has no controls at all: it ends with the film, or on any
        // button. The platform's would sit on top of it and answer first.
        nativeControls={false}
        accessibilityLabel="KROMA"
      />
      <Animated.View pointerEvents="none" style={[styles.veil, { opacity: veil }]} />
    </View>
  );
}

/** The full-screen box, spelled out: this react-native copy's types have no
 * `absoluteFillObject` to spread. */
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  stage: { ...FILL, zIndex: 9999, backgroundColor: colors.bg },
  veil: { ...FILL, backgroundColor: colors.bg },
});
