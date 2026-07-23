// Focus transition, web (Tizen / webOS / desktop / browser).
//
// A real CSS transition rather than Animated: on a TV's weak CPU a JS-driven
// interpolation of 20 visible rail tiles is a frame-rate cliff, while
// `transition: transform` stays on the compositor. react-native-web passes the
// transition* style props straight through to CSS.
//
// WHAT IS TRANSITIONED IS THE WHOLE POINT, and it was measured on the panel
// (a Samsung LS03D, driven through clients/tv-build/perf-tv.ts, walking the home
// rails for nine seconds):
//
//   transition: transform, box-shadow, background-color   38fps, 85 janky frames
//   transition: transform                                 50fps, 14 janky frames
//   no transition at all                                  58fps,  7 janky frames
//
// A transform is COMPOSITED: the GPU moves a layer it has already painted, and
// the frame costs nothing. `box-shadow` is not, and the focus ring is the worst
// possible case of it - drawn outside the element's box and heavily blurred, so
// every one of the twelve frames of its fade repaints the tile AND the region
// around it, twice over (the tile being left and the tile being entered). That
// single property was two thirds of the jank on the home screen.
//
// So the ring does not fade any more: it is simply there, on the frame the focus
// lands. On a television that reads as sharper rather than as missing - the
// ring's job is to answer the button, and a 200ms fade is a 200ms delay in
// answering it. The SCALE still eases, because that is the design's signature
// and it is free.

import { motion } from './tokens';

const DURATION = `${motion.duration.base}ms`;
const TIMING = `cubic-bezier(${motion.bezier.out.join(', ')})`;

/** A focusable with no scale gets no `transform` at all: a browse grid holds
 * hundreds of tiles, and a transform on each promotes each one to its own
 * compositing layer, which a TV GPU pays for even when the value is 1. With
 * nothing left to animate, it gets no transition either. */
const RING_ONLY = {} as const;

export function useFocusScale(focused: boolean, to: number): Record<string, unknown> {
  if (to === 1) return RING_ONLY;
  return {
    transform: [{ scale: focused ? to : 1 }],
    // `transform` alone. See the header: adding box-shadow here costs a third of
    // the frame rate on the television.
    transitionProperty: 'transform',
    transitionDuration: DURATION,
    transitionTimingFunction: TIMING,
  };
}
