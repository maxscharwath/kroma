/// <reference path="../types/react-native-tv.d.ts" />
// <FocusBridge>: a crossing for the focus engine.
//
// tvOS moves focus GEOMETRICALLY: pressing Up looks for a focusable in the band
// directly above the current one. Two regions that the eye reads as connected
// can therefore be unreachable from one another, and on this app they were:
// from the home hero's Lecture button (bottom left) the top nav pill (centred)
// has nothing of it directly overhead, so Films / Series / Genres could not be
// reached with the remote at all.
//
// UIKit's answer is a focus GUIDE: an invisible region that hands focus to views
// you nominate when the engine searches into it. This wraps that.
//
// Place it in the GAP, thin and spanning the axis you want crossed - never as a
// large area over content. A guide that covers a whole column also catches the
// moves you did not mean to redirect, which is how an earlier attempt made a
// button unreachable instead of reachable.
//
// It draws nothing and takes no touches. On the web it renders nothing at all,
// because that engine's weighted nearest-neighbour search already crosses gaps.

import { type RefObject, useEffect, useState } from 'react';
import { type StyleProp, TVFocusGuideView, type ViewStyle } from 'react-native';

interface FocusBridgeProps {
  /** Where focus lands when it enters this region. Any host component will do:
   * UIKit finds the preferred focusable inside it. */
  to: RefObject<unknown>;
  /** The gap being bridged. Keep it thin. */
  style?: StyleProp<ViewStyle>;
}

function FocusBridge({ to, style }: Readonly<FocusBridgeProps>) {
  // Refs are attached AFTER the first render, so a guide that reads `to.current`
  // while rendering always sees null and ends up with no destination at all -
  // an invisible box that quietly does nothing, which is exactly how the first
  // attempt at this failed. One state flip on mount re-renders it once the
  // target exists.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const target = mounted ? to.current : null;
  return <TVFocusGuideView destinations={target ? [target] : []} style={style} />;
}

export type { FocusBridgeProps };
export { FocusBridge };
