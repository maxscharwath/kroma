// `expo-notifications` calls `requireNativeModule()` at module scope, which
// throws when the native module is not in the running binary — imported eagerly
// that takes the whole app down at launch, so it goes through a guarded require.
//
// It must be `require` and NOT `await import(...)`: Metro compiles a dynamic
// import in a dev build into a split-bundle fetch that throws
// `Expected HMRClient.setup() call at startup`.

type NotificationsModule = typeof import('expo-notifications');

function load(): NotificationsModule | null {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

const notifications = load();

/** The notifications module, or `null` when this build has no native support. */
export function push(): NotificationsModule | null {
  return notifications;
}
