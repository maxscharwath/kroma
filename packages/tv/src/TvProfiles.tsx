import { useCallback, useEffect, useState } from 'react';
import type { AuthResult, LumaClient, PublicUser, QuickConnectInit, StoredSession } from '@luma/core';
import { Button, Logo } from '@luma/ui';
import { useAuth } from '#tv/auth';
import { useClient } from '#tv/router';
import { useFocusNav } from '#tv/useFocusNav';

// Same vivid gradient palette as the web profiles (LUMA.dc.html).
const GRADS = [
  'linear-gradient(135deg,#F4B642,#E8743B)',
  'linear-gradient(135deg,#3BC9DB,#3B82F6)',
  'linear-gradient(135deg,#A855F7,#6366F1)',
  'linear-gradient(135deg,#F472B6,#EC4899)',
  'linear-gradient(135deg,#34D399,#10B981)',
];

function gradFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADS[h % GRADS.length] as string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function ProfileAvatar({ name, seed, size }: { name: string; seed: string; size: number }) {
  return (
    <div
      className="flex items-center justify-center font-display font-bold text-white/90"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.13),
        background: gradFor(seed),
        fontSize: Math.round(size * 0.38),
        boxShadow: '0 16px 40px rgba(0,0,0,.5)',
      }}
    >
      {initials(name)}
    </div>
  );
}

const INPUT =
  'w-full rounded-[10px] border border-border-strong bg-surface-2 px-5 py-4 text-center font-sans text-[18px] text-text';

type View = { v: 'pick' } | { v: 'login'; user: PublicUser } | { v: 'register' } | { v: 'quick' };

/**
 * 10-foot login gate. Shown after the server connects, before the home view,
 * whenever there's no session. A profile is selected with the remote, then its
 * password is typed in; new accounts can also be created (avatar upload stays a
 * web-only feature — TV accounts use the gradient/initials avatar).
 */
export function TvProfiles() {
  const client = useClient();
  const { profiles, accounts, login, activate } = useAuth();
  const [view, setView] = useState<View>({ v: 'pick' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onBack = useCallback(() => {
    setError('');
    setView({ v: 'pick' });
  }, []);
  useFocusNav({ resetKey: view.v, onBack });

  const run = useCallback(
    async (op: () => Promise<AuthResult>, failMsg: string) => {
      setBusy(true);
      setError('');
      try {
        login(await op());
      } catch (e) {
        setError(e instanceof Error && /401|identifiants|invalid/i.test(e.message) ? 'Identifiants invalides' : failMsg);
      } finally {
        setBusy(false);
      }
    },
    [login],
  );

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-16 text-center"
      style={{ background: 'radial-gradient(120% 90% at 50% 0%, #15131C, #0A0A0C 70%)' }}
    >
      <div className="mb-12">
        <Logo size={40} />
      </div>

      {view.v === 'pick' ? (
        <PickView
          profiles={profiles}
          accounts={accounts}
          onSelect={(u) => {
            setError('');
            // Already signed-in on this device → switch instantly, no password.
            const acc = accounts.find((a) => a.user.id === u.id);
            if (acc) activate(acc);
            else setView({ v: 'login', user: u });
          }}
          onAdd={() => {
            setError('');
            setView({ v: 'register' });
          }}
          onQuick={() => {
            setError('');
            setView({ v: 'quick' });
          }}
        />
      ) : null}

      {view.v === 'quick' ? (
        <QuickConnectView client={client} onAuthenticated={login} />
      ) : null}

      {view.v === 'login' ? (
        <LoginView
          user={view.user}
          busy={busy}
          error={error}
          onSubmit={(password) => run(() => client.login(view.user.username, password), 'Connexion impossible')}
        />
      ) : null}

      {view.v === 'register' ? (
        <RegisterView
          busy={busy}
          error={error}
          onSubmit={(email, username, password) =>
            run(() => client.register(email, username, password), 'Création impossible')
          }
        />
      ) : null}
    </div>
  );
}

function PickView({
  profiles,
  accounts,
  onSelect,
  onAdd,
  onQuick,
}: {
  profiles: PublicUser[];
  accounts: StoredSession[];
  onSelect: (u: PublicUser) => void;
  onAdd: () => void;
  onQuick: () => void;
}) {
  return (
    <>
      <h1 className="m-0 mb-12 font-display text-[44px] font-semibold">Qui regarde&nbsp;?</h1>
      <div className="flex flex-wrap items-start justify-center gap-10">
        {profiles.map((p) => {
          const remembered = accounts.some((a) => a.user.id === p.id);
          return (
            <div
              key={p.id}
              data-focus=""
              tabIndex={0}
              role="button"
              onClick={() => onSelect(p)}
              className="flex w-[160px] cursor-pointer flex-col items-center gap-4 rounded-[20px] p-2 outline-none transition-transform focus:scale-[1.06] focus:[&>div]:shadow-[0_0_0_4px_#F4B642,0_16px_40px_rgba(0,0,0,.5)]"
            >
              <div className="relative">
                <ProfileAvatar name={p.username} seed={p.id} size={150} />
                {remembered ? null : (
                  <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(10,10,12,0.78)] text-[rgba(244,243,240,0.85)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </span>
                )}
              </div>
              <span className="font-sans text-[20px] font-medium text-[rgba(244,243,240,0.82)]">{p.username}</span>
            </div>
          );
        })}
        <div
          data-focus=""
          tabIndex={0}
          role="button"
          onClick={onAdd}
          className="flex w-[160px] cursor-pointer flex-col items-center gap-4 rounded-[20px] p-2 outline-none transition-transform focus:scale-[1.06]"
        >
          <div className="flex h-[150px] w-[150px] items-center justify-center rounded-[20px] border-2 border-dashed border-[rgba(255,255,255,0.2)] text-[rgba(255,255,255,0.4)]">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <span className="font-sans text-[20px] font-medium text-[rgba(244,243,240,0.5)]">Ajouter</span>
        </div>
      </div>
      <button
        data-focus=""
        type="button"
        onClick={onQuick}
        className="mt-12 inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-[rgba(255,255,255,0.2)] bg-transparent px-6 py-3 font-sans text-[16px] font-semibold text-[rgba(244,243,240,0.78)] outline-none transition-transform focus:scale-[1.05] focus:border-accent focus:text-accent"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3M20 20v.01M20 14v.01M14 20v.01" />
        </svg>
        Connexion rapide
      </button>
      <p className="mt-5 font-sans text-[15px] font-semibold text-dim">◀ ▶ Choisir · OK Sélectionner</p>
    </>
  );
}

function LoginView({
  user,
  busy,
  error,
  onSubmit,
}: {
  user: PublicUser;
  busy: boolean;
  error: string;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (password) onSubmit(password);
      }}
      className="flex w-full max-w-[460px] flex-col items-center gap-5"
    >
      <ProfileAvatar name={user.username} seed={user.id} size={104} />
      <h1 className="m-0 font-display text-[30px] font-bold">{user.username}</h1>
      <input
        data-focus=""
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mot de passe"
        className={INPUT}
      />
      {error ? <p className="m-0 font-sans text-[15px] text-danger">{error}</p> : null}
      <Button type="submit" data-focus="">
        {busy ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  );
}

function RegisterView({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onSubmit: (email: string, username: string, password: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const valid = email.includes('@') && username.trim().length > 0 && password.length >= 4;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(email.trim(), username.trim(), password);
      }}
      className="flex w-full max-w-[460px] flex-col items-center gap-4"
    >
      <h1 className="m-0 mb-2 font-display text-[30px] font-bold">Nouveau compte</h1>
      <input data-focus="" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={INPUT} />
      <input data-focus="" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nom d'utilisateur" className={INPUT} />
      <input
        data-focus=""
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mot de passe (4+ caractères)"
        className={INPUT}
      />
      {error ? <p className="m-0 font-sans text-[15px] text-danger">{error}</p> : null}
      <Button type="submit" data-focus="">
        {busy ? 'Création…' : 'Créer le compte'}
      </Button>
    </form>
  );
}

/**
 * Quick Connect: the TV shows a short code (and a QR when the server knows the
 * web URL); an already-signed-in user approves it from the web app, and the TV
 * logs in on its next poll — no password typed on the remote.
 */
function QuickConnectView({
  client,
  onAuthenticated,
}: {
  client: LumaClient;
  onAuthenticated: (res: AuthResult) => void;
}) {
  const [info, setInfo] = useState<QuickConnectInit | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let secret = '';

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await client.quickConnectPoll(secret);
        if (cancelled) return;
        if (res.status === 'authorized') {
          onAuthenticated({ token: res.token, user: res.user });
          return;
        }
        if (res.status === 'expired') {
          void begin();
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      timer = setTimeout(poll, 2500);
    };

    const begin = async () => {
      try {
        const init = await client.quickConnectInitiate();
        if (cancelled) return;
        secret = init.secret;
        setInfo(init);
        setQr(null);
        // Build the approval URL (server's authorizeUrl if LUMA_WEB_URL is set,
        // else derive the LUMA web app from the API origin) and render a QR.
        const url = connectUrl(client, init.code, init.authorizeUrl);
        if (url) {
          void import('qrcode-generator')
            .then((mod) => {
              if (cancelled) return;
              const make = mod.default;
              const qrc = make(0, 'M');
              qrc.addData(url);
              qrc.make();
              setQr(qrc.createSvgTag({ cellSize: 6, margin: 1, scalable: true }));
            })
            .catch(() => undefined);
        }
        timer = setTimeout(poll, 2500);
      } catch {
        if (!cancelled) setError('Connexion rapide indisponible');
      }
    };

    void begin();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, onAuthenticated]);

  useFocusNav({ resetKey: 'quick' });

  return (
    <div className="flex w-full max-w-[760px] flex-col items-center gap-7 text-center">
      <h1 className="m-0 font-display text-[34px] font-bold">Connexion rapide</h1>

      {error ? (
        <p className="font-sans text-[16px] text-danger">{error}</p>
      ) : info ? (
        <div className="flex flex-col items-center gap-6">
          {qr ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line react/no-danger */}
              <div
                className="h-[220px] w-[220px] rounded-2xl bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <span className="font-sans text-[14px] font-semibold text-dim">Scanne ce QR avec ton téléphone</span>
            </div>
          ) : null}

          <p className="m-0 font-sans text-[16px] text-muted">
            ou sur l'app LUMA → <b className="text-text">Connecter un appareil</b>, saisis :
          </p>
          <div className="font-display text-[96px] font-bold leading-none tracking-[0.2em] text-accent tabular-nums">
            {info.code}
          </div>
        </div>
      ) : (
        <div className="h-10 w-10 rounded-full border-[3px] border-[rgba(255,255,255,0.2)] border-t-accent [animation:tvp-spin_0.9s_linear_infinite]" />
      )}

      <p className="font-sans text-[14px] font-semibold text-dim">Retour pour revenir aux profils</p>
    </div>
  );
}

/** Resolve the web `/connect?code=` URL for the QR: the server's `authorizeUrl`
 * (set when `LUMA_WEB_URL` is configured) wins; otherwise derive it from the API
 * origin — the LUMA web app runs alongside the API on port 3000 by convention. */
function connectUrl(client: LumaClient, code: string, serverUrl?: string | null): string {
  if (serverUrl) return serverUrl;
  try {
    const u = new URL(client.baseUrl);
    u.port = '3000';
    u.pathname = '/connect';
    u.search = `?code=${code}`;
    return u.toString();
  } catch {
    return '';
  }
}
