/// <reference path="../types/react-native-tv.d.ts" />
// Wiring the remote into the spatial navigator, once, for every target.
//
// The navigator (react-tv-space-navigation, built on the BBC's LRUD) does not
// listen to anything by itself: it is given a stream of directions and decides
// what is next to what. That is why it behaves identically on an Apple TV, an
// Android TV and a browser-based television - and why this app finally has ONE
// focus engine instead of a native one and a web one that drift apart.
//
// The TV remote is read through `useTVEventHandler`, deliberately: it is a hook
// rather than the plain emitter, and this fork's emitter export has been
// unreliable, while the hook is the path the player has always used. So the
// subscription the navigator asks for is a mailbox, and a hook mounted with the
// screen posts to it.

import { type HWEvent, useTVEventHandler } from 'react-native';
import { SpatialNavigation } from 'react-tv-space-navigation';
import { inputHeld } from './input-gate';
import { markPress } from './perf';
import { isRemoteKeyUp } from './tv-remote';

/** LRUD's directions, as plain strings, so nothing depends on the shape of a
 * re-exported enum. */
const UP = 'up';
const DOWN = 'down';
const LEFT = 'left';
const RIGHT = 'right';
const ENTER = 'enter';

type Direction = typeof UP | typeof DOWN | typeof LEFT | typeof RIGHT | typeof ENTER;

/** The remote's vocabulary. Both halves of the Siri remote are here: the
 * clickpad sends `up`/`down`/..., a thumb swipe on the touch surface sends
 * `swipeUp`/`swipeDown`/... They come from different gesture recognisers and
 * never both fire for one gesture. */
const REMOTE: Record<string, Direction> = {
  up: UP,
  down: DOWN,
  left: LEFT,
  right: RIGHT,
  swipeUp: UP,
  swipeDown: DOWN,
  swipeLeft: LEFT,
  swipeRight: RIGHT,
  select: ENTER,
};

/**
 * Where directions are posted while a navigator is listening.
 *
 * A SET, not a single slot: screens stack, so two navigators can be subscribed
 * for a moment, and React tears the old subscription down AFTER the new one is
 * up. With one slot that teardown nulls the live handler and the remote goes
 * dead.
 */
const handlers = new Set<(direction: Direction) => void>();

/**
 * Point the navigator at whichever remote this build actually has.
 *
 * Called once, at startup, before the first screen renders. Calling it twice is
 * harmless: the navigator keeps only the latest pair.
 */
export function configureRemote(): void {
  SpatialNavigation.configureRemoteControl({
    remoteControlSubscriber: (handle: (direction: Direction) => void) => {
      handlers.add(handle);
      return () => {
        handlers.delete(handle);
      };
    },
    remoteControlUnsubscriber: (stop: () => void) => stop(),
  });
}

/** True when the running React Native ships the TV remote surface. Resolved at
 * module scope so the hook count never changes between builds. */
const HAS_TV_EVENTS = typeof useTVEventHandler === 'function';
const useRemoteEvents: (handler: (event: HWEvent) => void) => void = HAS_TV_EVENTS
  ? useTVEventHandler
  : () => {};

/** Posts the TV remote into the navigator. Mounted by <FocusScope>, so it lives
 * exactly as long as a screen does. */
export function useRemoteBridge(): void {
  useRemoteEvents((event: HWEvent) => {
    if (isRemoteKeyUp(event)) return;
    // Something full-screen is over the app (the brand intro): it owns the
    // remote, and moving focus on a screen nobody can see is worse than inert.
    if (inputHeld()) return;
    const direction = REMOTE[event.eventType];
    if (!direction) return;
    markPress();
    for (const handle of handlers) handle(direction);
  });
}
