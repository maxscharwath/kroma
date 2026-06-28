import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '#web/lib/auth';
import { avatarGradient, initials } from '#web/components/UserAvatar';

// Public invitation acceptance page. An admin (with `users.manage`) shares
// `/join?invite=TOKEN`; the invitee creates their account here. The global
// AuthGate is bypassed on this path so a not-yet-user can reach it.
export const Route = createFileRoute('/join')({
  validateSearch: (s: Record<string, unknown>): { invite?: string } => ({
    invite: typeof s.invite === 'string' ? s.invite : undefined,
  }),
  component: JoinPage,
});

const INPUT =
  'w-full rounded-[10px] border border-border-strong bg-surface-2 px-4 py-3.5 text-[15px] text-text outline-none transition-colors placeholder:text-dim focus:border-accent';
const RADIAL = 'radial-gradient(120% 90% at 50% 0%, #15131C, #0A0A0C 70%)';

function JoinPage() {
  const { invite } = Route.useSearch();
  const { client, register } = useAuth();

  const [status, setStatus] = useState<'checking' | 'invalid' | 'ok'>('checking');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Validate the token up front.
  useEffect(() => {
    if (!invite) {
      setStatus('invalid');
      return;
    }
    let cancelled = false;
    client
      .checkInvite(invite)
      .then((r) => {
        if (!cancelled) setStatus(r.valid ? 'ok' : 'invalid');
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [client, invite]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pickFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setAvatar(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  const valid = email.includes('@') && username.trim().length > 0 && password.length >= 4;

  async function submit() {
    if (!valid || !invite) return;
    setBusy(true);
    setError(null);
    try {
      await register(email.trim(), username.trim(), password, avatar, invite);
      // On success the AuthProvider signs us in; navigating home drops the gate.
      window.location.assign('/');
    } catch (e) {
      setError(
        e instanceof Error && /403|invalid|expir/i.test(e.message)
          ? 'Invitation invalide ou expirée'
          : e instanceof Error && /409|déjà|exist/i.test(e.message)
            ? 'Cet email est déjà utilisé'
            : 'Création du compte impossible',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto px-6 py-12" style={{ background: RADIAL }}>
      <div className="mb-10 flex items-center gap-2.5">
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="13" stroke="#F4B642" strokeWidth="2.4" />
          <circle cx="16" cy="16" r="4.5" fill="#F4B642" />
        </svg>
        <span className="font-display text-[24px] font-extrabold tracking-[.16em]">LUMA</span>
      </div>

      {status === 'checking' ? (
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/15 border-t-accent" />
      ) : status === 'invalid' ? (
        <div className="text-center">
          <h1 className="mb-2 font-display text-[28px] font-bold">Invitation invalide</h1>
          <p className="text-[14px] text-muted">Ce lien d'invitation est expiré, a déjà été utilisé, ou n'existe pas.</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex w-full max-w-[380px] flex-col items-center gap-5"
        >
          <h1 className="font-display text-[28px] font-semibold">Rejoindre LUMA</h1>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-[112px] w-[112px] overflow-hidden rounded-[16px] focus:outline-none"
            aria-label="Choisir un avatar"
          >
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/85" style={{ background: avatarGradient(username || email || 'new') }}>
                {username.trim() ? (
                  <span className="font-display text-[40px] font-bold">{initials(username)}</span>
                ) : (
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </div>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
              Photo
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

          <input className={INPUT} type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={INPUT} placeholder="Nom d'utilisateur" autoComplete="nickname" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className={INPUT} type="password" placeholder="Mot de passe (4+ caractères)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />

          {error ? <p className="text-[13px] font-medium text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || !valid}
            className="mt-1 w-full rounded-[10px] bg-accent py-3.5 text-[15px] font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
      )}
    </main>
  );
}
