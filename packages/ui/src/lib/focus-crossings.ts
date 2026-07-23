// The neighbour table: which control a given control names in a direction.
//
// A television moves focus in a straight band and gives up when nothing sits
// directly in the pressed direction. tvOS's answer is `nextFocusUp` and friends:
// the native view lays a one-pixel UIFocusGuide on that side of the control and
// points it at the neighbour, so the press lands where you said. That IS the
// right mechanism, and it works under the New Architecture - Fabric assigns
// `UIView.tag` in RCTComponentViewRegistry, so the `[rootView viewWithTag:]`
// lookup behind those props resolves.
//
// What does NOT work is handing it a ref: `nextFocusUp` takes a TAG, and a ref's
// `.current` is null on the render that sets the prop. The prop is then set to
// nothing, and it never changes again, so the guide is never built. (The same
// trap swallows `TVFocusGuideView`'s `destinations`, which is delivered by an
// imperative command from an effect keyed on the prop: pass `[ref.current]` and
// the command fires once, with an empty list.)
//
// So this module is the indirection that makes refs usable: controls register
// their host view here, anyone can name one as a neighbour, and a subscription
// tells the namer when the target has actually mounted - at which point it has a
// real node to turn into a tag. No timers, no JavaScript focus engine, no second
// guess at what the platform was going to do: the OS still owns every move.

/** A neighbour, as a ref to another control's host view. */
export type Crossing = { current: unknown } | null | undefined;

export interface Crossings {
  up?: Crossing;
  down?: Crossing;
  left?: Crossing;
  right?: Crossing;
}

/** Marks the crossing that means "wherever this screen starts". */
const ENTRY = Symbol('screen entry');

/**
 * The screen's own entry point, as a crossing target.
 *
 * Naming a control by ref works when the neighbour is a fixed landmark (the nav
 * bar's first chip is the same chip on every screen). It does not work for the
 * pinned Back button, whose way back into the page is a different control on
 * each of the fifteen screens that render one, and threading a ref through all
 * of them would put focus plumbing in every screen file.
 *
 * The screens already say where they start - that is `autoFocus` - so a Back
 * button can point AT that statement instead of at a particular control, and
 * every screen answers it for free.
 */
export const screenEntry: Crossing = { current: ENTRY };

/** The `autoFocus` controls currently mounted, innermost last: a sheet over a
 * page declares its own entry and owns it until it closes. */
const entries: { id: string; host: unknown }[] = [];
const listeners = new Set<() => void>();

/**
 * Announce that a control has mounted or gone.
 *
 * Everything here is a mount-order problem: a control can only be named once its
 * view exists, and the namer usually renders first. Every registration wakes the
 * namers so they resolve again, which is why this is a subscription rather than
 * a lookup.
 */
function announce(): void {
  // Only controls that NAME a neighbour subscribe, and there is a handful of
  // those against a screenful of controls, so this stays cheap even though every
  // mount calls it.
  for (const listener of listeners) listener();
}

/** Announce a control's mount (or unmount). Every control does this, because any
 * of them may be the one somebody else is waiting for. */
export function announceRegistered(): void {
  if (listeners.size > 0) announce();
}

/**
 * Whether any control on the current screen has received focus yet.
 *
 * Read by <FocusScope>, which bootstraps a screen that would otherwise open with
 * focus nowhere. That bootstrap is a full-screen focus guide, and a full-screen
 * guide is a candidate in EVERY direction - so it has to stop existing the
 * moment it has done its job, or it spends the rest of the screen's life
 * catching presses that should have gone nowhere and bouncing focus to the first
 * control. See lib/focus-scope.
 */
let landed = false;

export function noteFocused(): void {
  if (landed) return;
  landed = true;
  announce();
}

export function focusLanded(): boolean {
  return landed;
}

/** Called by a new screen: nothing has been focused on it yet. */
export function resetFocusLanded(): void {
  if (!landed) return;
  landed = false;
  announce();
}

/** Subscribe to registrations. Returns the unsubscribe. */
export function onRegistryChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Register or withdraw a control's claim to be its screen's entry point. */
export function declareEntry(id: string, host: unknown, isEntry: boolean): void {
  const at = entries.findIndex((e) => e.id === id);
  if (isEntry && host) {
    if (at === -1) entries.push({ id, host });
    else entries[at] = { id, host };
  } else if (at !== -1) {
    entries.splice(at, 1);
  } else {
    return;
  }
  announce();
}

/**
 * Who the screen's entry point currently is.
 *
 * The LAST declaration wins, and that is the whole point: a screen's real entry
 * control often mounts late (the profile list arrives from storage, the hero
 * from the server), after a placeholder has already declared itself. The entry
 * moves to it, and the engine gives it focus - as long as the viewer has not
 * started navigating, which is checked where the claim is made.
 */
export function entryOwner(): string | null {
  return entries.at(-1)?.id ?? null;
}

/** The entry point's host view, for <FocusScope> to point its guide at. */
export function entryHost(): unknown {
  return entries.at(-1)?.host ?? null;
}

/**
 * The host view a crossing points at, or null while it is not mounted yet.
 *
 * `screenEntry` resolves to the innermost mounted entry point; anything else is
 * a plain ref and resolves to whatever it holds.
 */
export function crossingTarget(crossing: Crossing): unknown {
  const target = crossing?.current;
  if (!target) return null;
  if (target !== ENTRY) return target;
  return entries.at(-1)?.host ?? null;
}
