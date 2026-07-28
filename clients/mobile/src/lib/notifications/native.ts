// Reaching expo-notifications without betting the app on it.
//
// `expo-notifications` is a NATIVE module, and its entry point calls
// `requireNativeModule()` at module scope — which throws when the module is not
// in the running binary. That happens more often than it sounds: any build made
// before the dependency was added (an installed dev client, a colleague's
// simulator, a TestFlight build from last week) has the new JS but not the new
// native code.
//
// Imported eagerly from the root layout, that throw takes the WHOLE APP down on
// launch. So it is loaded lazily and softly instead: `push()` returns null when
// the module isn't there, every caller treats null as "push is unavailable
// here", and the rest of the app is untouched.
//
// The fix for the underlying condition is a native rebuild (`expo prebuild` +
// `expo run:ios` / `run:android`). This just makes the failure a disabled
// toggle rather than a dead app.

type NotificationsModule = typeof import('expo-notifications');

/** `undefined` = not tried yet, `null` = tried and unavailable. */
let cached: NotificationsModule | null | undefined;

/**
 * The notifications module, or `null` when this build has no native support.
 *
 * Resolved once and remembered: the import either works for the process's
 * lifetime or never will, and retrying would re-run the module's side effects.
 */
export async function push(): Promise<NotificationsModule | null> {
  if (cached !== undefined) return cached;
  try {
    cached = await import('expo-notifications');
  } catch {
    cached = null;
  }
  return cached;
}

/** Whether native push is usable in this build at all. */
export async function hasNativePush(): Promise<boolean> {
  return (await push()) !== null;
}
