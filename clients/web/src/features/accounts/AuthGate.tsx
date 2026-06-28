// The login gate. Rendered as a full-screen overlay by the root layout whenever
// no session is active, so the catalogue underneath is never usable until a real
// account is chosen. Visual design follows LUMA.dc.html's "Qui regarde ?" screen
// (rounded-square gradient avatars, Bricolage headings) while keeping real
// account semantics: selecting a profile asks for its password, and new accounts
// are created with email + username + password + an optional uploaded avatar.

import type { PublicUser } from '@luma/core';
import { Logo, useT } from '@luma/ui';
import { IconLock } from '@tabler/icons-react';
import { useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LoginForm, RegisterForm } from '#web/features/accounts/AuthForms';
import { UserAvatar } from '#web/features/accounts/UserAvatar';
import { useAuth } from '#web/shared/lib/auth';

type Mode = { kind: 'pick' } | { kind: 'login'; user: PublicUser | null } | { kind: 'register' };

const RADIAL = 'radial-gradient(120% 90% at 50% 0%, #15131C, #0A0A0C 70%)';

export function AuthGate() {
  const { user, ready } = useAuth();
  const { pathname } = useLocation();

  // Logged in → the gate is invisible and the app shows through.
  if (ready && user) return null;
  // The public join page (invitees aren't users yet) must not be gated.
  if (pathname === '/join') return null;

  return (
    <div
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-y-auto px-6 py-12"
      style={{ background: RADIAL }}
    >
      <Brand />
      {ready ? <GateBody /> : <Spinner />}
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-12 flex items-center gap-2.5">
      <Logo markOnly size={30} />
      <span className="font-display text-[24px] font-extrabold tracking-[.16em]">LUMA</span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/15 border-t-accent" />
  );
}

function GateBody() {
  const t = useT();
  const { client, accounts, login, register, activate, forget } = useAuth();
  const [profiles, setProfiles] = useState<PublicUser[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: 'pick' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the existing profiles for the picker (public, no token needed).
  useEffect(() => {
    let cancelled = false;
    client
      .users()
      .then((u) => {
        if (cancelled) return;
        setProfiles(u);
        // Fresh install (no accounts yet) → go straight to registration.
        if (u.length === 0) setMode({ kind: 'register' });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client]);

  function fail(e: unknown, fallback: string) {
    setError(
      e instanceof Error && /401|invalid|identifiants/i.test(e.message)
        ? t('auth.invalidCredentials')
        : fallback,
    );
  }

  async function doLogin(identifier: string, password: string) {
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
    } catch (e) {
      fail(e, t('auth.loginFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function doRegister(
    email: string,
    username: string,
    password: string,
    avatar: File | null,
  ) {
    setBusy(true);
    setError(null);
    try {
      await register(email, username, password, avatar);
    } catch (e) {
      setError(
        e instanceof Error && /409|déjà|exist/i.test(e.message)
          ? t('auth.emailTaken')
          : t('auth.registerFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (mode.kind === 'login') {
    return (
      <LoginForm
        profile={mode.user}
        busy={busy}
        error={error}
        onBack={() => {
          setError(null);
          setMode({ kind: 'pick' });
        }}
        onSubmit={doLogin}
      />
    );
  }

  if (mode.kind === 'register') {
    return (
      <RegisterForm
        busy={busy}
        error={error}
        canGoBack={profiles.length > 0}
        onBack={() => {
          setError(null);
          setMode({ kind: 'pick' });
        }}
        onSubmit={doRegister}
      />
    );
  }

  // --- picker ---
  return (
    <>
      <h1 className="mb-12 font-display text-[40px] font-semibold">{t('auth.whoWatching')}</h1>
      <div className="flex flex-wrap items-start justify-center gap-9">
        {profiles.map((p) => {
          // Already signed-in on this device → one-tap switch, no password.
          const remembered = accounts.find((a) => a.user.id === p.id);
          return (
            <div key={p.id} className="flex w-37.5 flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (remembered) activate(remembered);
                  else setMode({ kind: 'login', user: p });
                }}
                className="group flex flex-col items-center gap-4 transition-transform duration-200 hover:-translate-y-1.5 focus:outline-none"
              >
                <div className="relative rounded-[18px] ring-accent transition-shadow duration-200 group-hover:shadow-[0_0_0_4px_var(--luma-accent),0_16px_40px_rgba(0,0,0,.5)] group-focus-visible:shadow-[0_0_0_4px_var(--luma-accent),0_16px_40px_rgba(0,0,0,.5)]">
                  <UserAvatar name={p.username} avatarUrl={p.avatarUrl} seed={p.id} size={138} />
                  {remembered ? null : (
                    <span
                      className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/85"
                      title={t('auth.passwordRequired')}
                    >
                      <IconLock size={14} stroke={2} />
                    </span>
                  )}
                </div>
                <span className="text-[18px] font-medium text-text/78">{p.username}</span>
              </button>
              {remembered ? (
                <button
                  type="button"
                  onClick={() => forget(p.id)}
                  className="text-[12px] font-medium text-dim transition-colors hover:text-text"
                >
                  {t('auth.logout')}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setMode({ kind: 'login', user: null })}
        className="mt-14 rounded-lg border border-white/20 px-5 py-2.5 text-[13px] font-semibold uppercase tracking-widest text-text/70 transition-colors hover:border-accent hover:text-accent"
      >
        {t('auth.loginEmail')}
      </button>
    </>
  );
}
