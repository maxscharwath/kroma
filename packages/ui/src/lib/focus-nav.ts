/// <reference path="../types/react-native-tv.d.ts" />
/// <reference path="../types/react-native-web.d.ts" />
// Native focus engine (Apple TV, Android TV, and phones).
//
// The OS focus engine owns directional movement: UIFocusEngine on tvOS, the
// Android view hierarchy's nextFocus resolution on Android TV. That is a strict
// upgrade over a geometric scan in JavaScript - real remote semantics, correct
// focus sounds, focus memory, scroll-to-reveal, no measurement storm on every key
// press - so this module never moves focus itself. It does three things:
//
//  1. Bridges the two keys the OS does NOT route to a focusable: Back and
//     PlayPause. (OK is not handled here either: Pressable fires `onPress` on
//     Select natively, and `<Focusable>` applies the press guard.)
//  2. Registers which control is a screen's entry point, for <FocusScope> to
//     point its guide at. Nothing here ever calls `hasTVPreferredFocus`: that
//     prop re-takes focus on every layout pass AND marks the control as the root
//     view's preferred focus permanently, so focus keeps snapping back to it.
//  3. Feeds tvOS the NEIGHBOURS a control declares, as `nextFocusUp` and friends,
//     so the platform lays its own one-pixel focus guide on that side.
//
// (3) is the part that used to be wrong, and the reason a JavaScript fallback
// existed here at all. Those props take a react TAG, not a ref; handing them
// `ref.current` sets them to nothing on the first render and they never change
// again, so no guide is ever built. Fabric does assign `UIView.tag`
// (RCTComponentViewRegistry), so once a real tag arrives the platform mechanism
// works - which is why the neighbour is resolved after mount, from a
// subscription, and kept in state. See lib/focus-crossings.
//
// The TV remote APIs only exist in the react-native-tvos fork, and the mobile
// app runs on mainline React Native. Everything below degrades to a no-op when
// they are absent, so the SAME screens and the same <Focusable> compile and run
// on a phone.

import { useEffect, useId, useRef, useState } from 'react';
import { BackHandler, findNodeHandle, type HWEvent, useTVEventHandler } from 'react-native';
import {
  announceRegistered,
  type Crossing,
  type Crossings,
  crossingTarget,
  declareEntry,
  noteFocused,
  onRegistryChange,
} from './focus-crossings';
import type { FocusHostProps, FocusNavHandlers } from './focus-types';
import { inputHeld } from './input-gate';
import { armPressGuard } from './press-guard';
import { holdMenuKey, isRemoteKeyUp, releaseMenuKey } from './tv-remote';

/** tvOS delivers the remote's Menu button as this event once the menu key is
 * claimed; Android TV routes its Back button through BackHandler instead. */
const BACK_EVENTS = new Set(['menu', 'back']);
const PLAY_PAUSE_EVENTS = new Set(['playPause', 'play', 'pause']);

/**
 * True when the running React Native ships the TV remote surface, i.e. when this
 * is the react-native-tvos fork. Resolved once at module scope so the hook
 * below always calls the same number of hooks, whichever build it lands in.
 */
const HAS_TV_EVENTS = typeof useTVEventHandler === 'function';

/** `useTVEventHandler` where it exists, a no-op hook where it does not. Bound at
 * module scope so React never sees the hook count change. */
const useRemoteEvents: (handler: (event: HWEvent) => void) => void = HAS_TV_EVENTS
  ? useTVEventHandler
  : () => {};

function useFocusNav({ onBack, onPlayPause, resetKey }: FocusNavHandlers): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is an intentional re-run trigger, mirroring the web engine; it is not read inside the effect.
  useEffect(() => {
    // Arm the guard on mount exactly like the web engine, so a held Select that
    // opened this screen cannot also fire the control the OS auto-focuses.
    armPressGuard();
  }, [resetKey]);

  useEffect(() => {
    if (!onBack) return;
    // Claim the Menu key so tvOS reports it instead of backing out of the app.
    // Absent on a phone, where the hardware back button below is the whole story.
    holdMenuKey();
    // A held remote still consumes Back (`true`), it just does nothing with it:
    // letting it through would leave the app while an overlay is on screen.
    const sub = BackHandler.addEventListener('hardwareBackPress', () =>
      inputHeld() ? true : onBack() !== false,
    );
    return () => {
      sub.remove();
      releaseMenuKey();
    };
  }, [onBack]);

  useRemoteEvents((evt: HWEvent) => {
    if (isRemoteKeyUp(evt) || inputHeld()) return;
    if (BACK_EVENTS.has(evt.eventType)) onBack?.();
    else if (PLAY_PAUSE_EVENTS.has(evt.eventType)) onPlayPause?.();
  });
}

/** The four `nextFocus*` tags, as tvOS wants them. */
interface NeighbourTags {
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
}

const NO_NEIGHBOURS: NeighbourTags = {};

/** A crossing's target as a react tag, or undefined while it is unmounted. */
function tagOf(crossing: Crossing): number | undefined {
  const target = crossingTarget(crossing);
  if (!target) return undefined;
  return findNodeHandle(target as Parameters<typeof findNodeHandle>[0]) ?? undefined;
}

function resolveNeighbours(crossings: Crossings | undefined): NeighbourTags {
  if (!crossings) return NO_NEIGHBOURS;
  const tags: NeighbourTags = {};
  if (crossings.up) tags.nextFocusUp = tagOf(crossings.up);
  if (crossings.down) tags.nextFocusDown = tagOf(crossings.down);
  if (crossings.left) tags.nextFocusLeft = tagOf(crossings.left);
  if (crossings.right) tags.nextFocusRight = tagOf(crossings.right);
  return tags;
}

function sameNeighbours(a: NeighbourTags, b: NeighbourTags): boolean {
  return (
    a.nextFocusUp === b.nextFocusUp &&
    a.nextFocusDown === b.nextFocusDown &&
    a.nextFocusLeft === b.nextFocusLeft &&
    a.nextFocusRight === b.nextFocusRight
  );
}

/** Props for one focusable host: focusability, the declared neighbours, and the
 * two registrations the screen-level guide reads (this control's host view, and
 * whether it is the screen's entry point). Inert on a phone, where there is
 * nothing to move focus with. */
function useFocusHostProps({
  autoFocus,
  disabled,
  neighbours,
  host,
  onFocus,
}: {
  autoFocus?: boolean;
  disabled?: boolean;
  neighbours?: Crossings;
  host?: { current: unknown };
  onFocus?: () => void;
}): FocusHostProps {
  const id = useId();
  const [tags, setTags] = useState<NeighbourTags>(NO_NEIGHBOURS);
  const declared = useRef(neighbours);
  declared.current = neighbours;

  // The neighbour a control names usually mounts AFTER the control that names
  // it, and `nextFocus*` wants a tag, so this cannot be done during render.
  useEffect(() => {
    if (!declared.current) return;
    const resolve = () =>
      setTags((prev) => {
        const next = resolveNeighbours(declared.current);
        return sameNeighbours(prev, next) ? prev : next;
      });
    resolve();
    return onRegistryChange(resolve);
  }, []);

  // Announced separately from the entry point, because ANY control can be the
  // one another is waiting for - most named neighbours are ordinary controls.
  useEffect(() => {
    announceRegistered();
    return announceRegistered;
  }, []);

  // `autoFocus` is also a statement about the screen, not just about this
  // control: it is where the screen starts, and so where <FocusScope> points its
  // bootstrap guide.
  useEffect(() => {
    declareEntry(id, autoFocus === true ? host?.current : null, autoFocus === true);
    return () => declareEntry(id, null, false);
  }, [id, autoFocus, host]);

  if (disabled) {
    // react-native-tvos gates a Pressable's focusability on exactly these two
    // (`focusable !== false && isTVSelectable !== false`).
    return { focusable: false, isTVSelectable: false };
  }
  // The focus props exist only in the TV fork. On a phone they would be unknown
  // props on a View, so the same component ships there carrying nothing extra.
  if (!HAS_TV_EVENTS) return { focusable: true, onFocus };
  return {
    focusable: true,
    isTVSelectable: true,
    onFocus: () => {
      // Tells <FocusScope> its bootstrap guide is no longer needed.
      noteFocused();
      onFocus?.();
    },
    ...tags,
  };
}

export { HAS_TV_EVENTS, useFocusHostProps, useFocusNav };
