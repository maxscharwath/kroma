import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '#web/lib/auth';

// "Connecter un appareil" — the approver side of Quick Connect. A TV shows a
// short code (or a QR pointing here with `?code=`); a signed-in user enters it
// to grant that device a session for their account. The global AuthGate already
// ensures the user is logged in before this page is usable.
export const Route = createFileRoute('/connect')({
  validateSearch: (s: Record<string, unknown>): { code?: string } => ({
    code: typeof s.code === 'string' ? s.code : undefined,
  }),
  component: ConnectPage,
});

function ConnectPage() {
  const { code: initial } = Route.useSearch();
  const { client, user } = useAuth();
  const [code, setCode] = useState(initial ?? '');
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setStatus('idle');
    try {
      await client.quickConnectAuthorize(c);
      setStatus('ok');
    } catch {
      setStatus('err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-surface-1 p-8 text-center shadow-card">
        <h1 className="mb-2 font-display text-[26px] font-bold">Connecter un appareil</h1>
        <p className="mb-7 text-[14px] leading-relaxed text-muted">
          Saisis le code à 4 chiffres affiché sur ta TV pour la connecter au compte
          {user ? ` de ${user.username}` : ''}.
        </p>

        {status === 'ok' ? (
          <div className="rounded-xl border border-success/40 bg-success/10 px-4 py-6">
            <div className="mb-1 text-[40px]">✓</div>
            <div className="font-display text-[18px] font-bold text-text">Appareil connecté</div>
            <p className="mt-1 text-[13px] text-muted">Ta TV va se connecter dans un instant.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex flex-col items-center gap-4"
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="1234"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="w-[200px] rounded-xl border border-border-strong bg-surface-2 py-4 text-center font-display text-[40px] font-bold tracking-[0.3em] text-text outline-none focus:border-accent"
            />
            {status === 'err' ? (
              <p className="text-[13px] font-medium text-danger">Code invalide ou expiré</p>
            ) : null}
            <button
              type="submit"
              disabled={busy || code.trim().length < 4}
              className="w-full rounded-[10px] bg-accent py-3.5 text-[15px] font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? 'Connexion…' : 'Autoriser'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
