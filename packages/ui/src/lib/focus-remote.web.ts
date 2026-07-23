// Wiring the remote into the spatial navigator, on the browser targets.
//
// The mirror of `focus-remote.ts`: same navigator, same four directions, a
// different source. Tizen and webOS deliver their remote as key events on the
// document, and so do the desktop shell and a developer's arrow keys - so there
// is nothing to bridge from React here, and no hook to mount.

import { Directions, SpatialNavigation } from 'react-tv-space-navigation';
import { webDocument } from './dom';
import { markPress } from './perf';

/** The keys a television's browser sends. Tizen and webOS name the four
 * directions without the `Arrow` prefix; everything else is a keyboard. */
const KEYS: Record<string, Directions> = {
  ArrowUp: Directions.UP,
  ArrowDown: Directions.DOWN,
  ArrowLeft: Directions.LEFT,
  ArrowRight: Directions.RIGHT,
  Enter: Directions.ENTER,
  Up: Directions.UP,
  Down: Directions.DOWN,
  Left: Directions.LEFT,
  Right: Directions.RIGHT,
};

export function configureRemote(): void {
  SpatialNavigation.configureRemoteControl({
    remoteControlSubscriber: (handle: (direction: Directions) => void) => {
      const document = webDocument();
      if (!document) return () => {};
      const onKey = (event: KeyboardEvent) => {
        const direction = KEYS[event.key];
        if (!direction) return;
        // A television's browser scrolls the page on an arrow key otherwise, and
        // the focused control walks out of the viewport.
        event.preventDefault();
        markPress();
        handle(direction);
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    },
    remoteControlUnsubscriber: (stop: () => void) => stop(),
  });
}

/** Nothing to mount: the listener above is not tied to a screen. Kept so
 * <FocusScope> can call it on every target. */
export function useRemoteBridge(): void {}
