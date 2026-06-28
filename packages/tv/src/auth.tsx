import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  type AuthResult,
  clearSession,
  forgetAccount,
  loadAccounts,
  loadSession,
  type LumaClient,
  type PublicUser,
  saveSession,
  type StoredSession,
} from '@luma/core';

interface Auth {
  /** The active session, or null when signed out. */
  session: StoredSession | null;
  /** The signed-in user (null when signed out). */
  user: StoredSession['user'] | null;
  /** Profiles to pick from on the login screen (loaded while signed out). */
  profiles: PublicUser[];
  /** Accounts already signed-in on this device — switchable without a password. */
  accounts: StoredSession[];
  /** Persist a successful auth result and sign in. */
  login: (res: AuthResult) => void;
  /** Switch to a remembered account instantly (no password re-entry). */
  activate: (s: StoredSession) => void;
  /** Back to the picker WITHOUT signing out (keeps remembered accounts). */
  switchProfile: () => void;
  /** Forget a remembered account on this device (real sign-out for it). */
  forget: (userId: string) => void;
  /** Fully sign out of the current account (invalidate + forget this device). */
  logout: () => void;
}

const AuthCtx = createContext<Auth | null>(null);

/**
 * Holds the per-user session and exposes it via `useAuth()` so screens never
 * prop-drill auth. Keeps the client's bearer token in sync with the session and
 * loads the profile list while signed out. Mounted inside <TvClientProvider> so
 * the `profiles` route and the home ProfileChip read it straight from the hook.
 */
export function AuthProvider({ client, children }: { client: LumaClient | null; children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => {
    const s = loadSession();
    // Apply the token during init (before children render) so the first authed
    // fetch — e.g. "Reprendre" — already carries it.
    if (s) client?.setAuthToken(s.token);
    return s;
  });
  const [profiles, setProfiles] = useState<PublicUser[]>([]);
  const [accounts, setAccounts] = useState<StoredSession[]>(() => loadAccounts());

  // Keep the bearer token in sync across client / session changes.
  useEffect(() => {
    client?.setAuthToken(session?.token);
  }, [client, session]);

  // Load the picker list while signed out.
  useEffect(() => {
    if (session || !client) return;
    let cancelled = false;
    client
      .users()
      .then((u) => {
        if (!cancelled) setProfiles(u);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, session]);

  const login = useCallback(
    (res: AuthResult) => {
      const s: StoredSession = { token: res.token, user: res.user };
      saveSession(s);
      client?.setAuthToken(res.token);
      setSession(s);
      setAccounts(loadAccounts());
    },
    [client],
  );

  // Switch to a remembered account instantly — no password.
  const activate = useCallback(
    (s: StoredSession) => {
      saveSession(s);
      client?.setAuthToken(s.token);
      setSession(s);
      setAccounts(loadAccounts());
    },
    [client],
  );

  // Back to the picker without signing out (token + remembered accounts kept).
  const switchProfile = useCallback(() => {
    client?.setAuthToken(undefined);
    clearSession();
    setSession(null);
  }, [client]);

  const forget = useCallback(
    (userId: string) => {
      forgetAccount(userId);
      setAccounts(loadAccounts());
      setSession((s) => {
        if (s?.user.id === userId) {
          client?.setAuthToken(undefined);
          return null;
        }
        return s;
      });
    },
    [client],
  );

  const logout = useCallback(() => {
    const id = session?.user.id;
    void client?.logout().catch(() => undefined);
    client?.setAuthToken(undefined);
    if (id) forgetAccount(id);
    else clearSession();
    setAccounts(loadAccounts());
    setSession(null);
  }, [client, session]);

  const value = useMemo<Auth>(
    () => ({
      session,
      user: session?.user ?? null,
      profiles,
      accounts,
      login,
      activate,
      switchProfile,
      forget,
      logout,
    }),
    [session, profiles, accounts, login, activate, switchProfile, forget, logout],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}
