import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { hasPermission, type Invite, type Permission } from '@luma/core';
import { useAuth } from '#web/lib/auth';

// Admin page to invite users. Gated by the `users.manage` permission — the only
// way (besides the bootstrap owner) to create accounts is via these invites.
export const Route = createFileRoute('/invite')({
  component: InvitePage,
});

const PERMS: { key: Permission; label: string; hint: string }[] = [
  { key: 'playback', label: 'Lecture', hint: 'Regarder le catalogue + reprise (par défaut)' },
  { key: 'library.manage', label: 'Bibliothèque', hint: 'Scans, bibliothèques, métadonnées' },
  { key: 'users.manage', label: 'Utilisateurs', hint: 'Gérer les comptes + inviter' },
  { key: 'settings.manage', label: 'Réglages', hint: 'Configuration du serveur' },
];

function joinUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/join?invite=${token}`;
}

function InvitePage() {
  const { user, client } = useAuth();
  const [selected, setSelected] = useState<Set<Permission>>(new Set<Permission>(['playback']));
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Invite[]>([]);

  const allowed = user ? hasPermission(user, 'users.manage') : false;

  const refresh = () => {
    if (!allowed) return;
    client.invites().then(setPending).catch(() => undefined);
  };
  useEffect(refresh, [allowed, client]);

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-[15px] text-muted">Tu n'as pas la permission de gérer les utilisateurs.</p>
      </main>
    );
  }

  function toggle(p: Permission) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function create() {
    setBusy(true);
    setCopied(false);
    try {
      const res = await client.createInvite({ permissions: [...selected] });
      setLink(joinUrl(res.token));
      refresh();
    } catch {
      setLink(null);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* clipboard blocked — the field is selectable */
    }
  }

  return (
    <main className="mx-auto max-w-[680px] px-[var(--gutter-web)] py-12">
      <h1 className="mb-2 font-display text-[30px] font-bold">Inviter un utilisateur</h1>
      <p className="mb-8 text-[14px] text-muted">
        Génère un lien d'invitation à partager. La personne crée son compte avec les permissions cochées.
      </p>

      <div className="rounded-2xl border border-border bg-surface-1 p-6">
        <div className="mb-4 text-[12px] font-bold uppercase tracking-[.12em] text-dim">Permissions</div>
        <div className="flex flex-col gap-2.5">
          {PERMS.map((p) => (
            <label key={p.key} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[.03]">
              <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} className="h-4 w-4 accent-[var(--luma-accent)]" />
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-text">{p.label}</span>
                <span className="block text-[12px] text-dim">{p.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void create()}
          disabled={busy || selected.size === 0}
          className="mt-5 rounded-[10px] bg-accent px-5 py-3 text-[14px] font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? 'Création…' : 'Créer le lien d’invitation'}
        </button>

        {link ? (
          <div className="mt-5 rounded-xl border border-accent/40 bg-accent-soft p-4">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-[.12em] text-accent">Lien d'invitation</div>
            <div className="flex items-center gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-[13px] text-text" />
              <button type="button" onClick={() => void copy()} className="shrink-0 rounded-lg bg-white/10 px-3.5 py-2.5 text-[13px] font-semibold text-text hover:bg-white/15">
                {copied ? 'Copié ✓' : 'Copier'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {pending.length > 0 ? (
        <div className="mt-8">
          <div className="mb-3 text-[12px] font-bold uppercase tracking-[.12em] text-dim">Invitations en attente</div>
          <div className="flex flex-col gap-2">
            {pending.map((inv) => (
              <div key={inv.token} className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3">
                <code className="truncate text-[13px] text-muted">{inv.token.slice(0, 12)}…</code>
                <span className="text-[12px] text-dim">{inv.permissions.join(', ')}</span>
                <button
                  type="button"
                  onClick={() => void client.revokeInvite(inv.token).then(refresh)}
                  className="ml-auto shrink-0 text-[13px] font-medium text-danger hover:underline"
                >
                  Révoquer
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
