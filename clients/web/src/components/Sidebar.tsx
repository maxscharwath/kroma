import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { hasPermission } from '@luma/core';
import { Logo } from '#web/components/ui';
import { CapabilityChip } from '#web/components/CapabilityChip';
import { UserAvatar } from '#web/components/UserAvatar';
import { useAuth } from '#web/lib/auth';

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const HOME = 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5';
const SEARCH = 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.3-4.3';
const FILM = 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16';
const TV = 'M3 5h18v12H3zM8 21h8';
const LIST = 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01';
const DEVICE = 'M4 5h16v11H4zM9 20h6M12 16v4';
const GEAR = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.4-2.3 1a8 8 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a8 8 0 0 0-1.7 1l-2.3-1-2 3.4L4.6 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 1.7 1l.3 2.6h4l.3-2.6a8 8 0 0 0 1.7-1l2.3 1 2-3.4Z';

const itemCls =
  'flex items-center gap-3.5 rounded-[11px] px-3.5 py-3 text-[15px] font-semibold text-muted no-underline transition-colors duration-200 hover:bg-white/[.04] hover:text-text aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent';

const NAV: { label: string; to: string; icon: ReactNode; exact?: boolean }[] = [
  { label: 'Accueil', to: '/', icon: <Icon d={HOME} />, exact: true },
  { label: 'Films', to: '/films', icon: <Icon d={FILM} /> },
  { label: 'Séries', to: '/series', icon: <Icon d={TV} /> },
];

const SOON: { label: string; icon: ReactNode }[] = [
  { label: 'Rechercher', icon: <Icon d={SEARCH} /> },
  { label: 'Ma liste', icon: <Icon d={LIST} /> },
];

export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-1 border-r border-border bg-[#0C0C0E] px-[18px] py-7">
      <div className="px-2 pb-4">
        <Logo size={26} />
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => (
          <Link key={item.to} to={item.to} className={itemCls} activeOptions={{ exact: item.exact ?? false }}>
            {item.icon}
            {item.label}
          </Link>
        ))}
        {SOON.map((item) => (
          <div key={item.label} className={`${itemCls} cursor-default opacity-50`}>
            {item.icon}
            {item.label}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2.5">
        <InviteLink />
        <Link to="/connect" className={itemCls}>
          <Icon d={DEVICE} />
          Connecter un appareil
        </Link>
        <div className={`${itemCls} cursor-default opacity-50`}>
          <Icon d={GEAR} />
          Réglages
        </div>
        <UserChip />
        <div className="flex flex-col gap-2.5 px-2 pt-2">
          <span className="text-[11px] font-bold uppercase tracking-[.12em] text-dim">Cet appareil</span>
          <CapabilityChip />
        </div>
      </div>
    </aside>
  );
}

const INVITE = 'M16 11a4 4 0 1 0-8 0M4 21v-1a6 6 0 0 1 12 0v1M19 8v6M22 11h-6';

/** "Inviter un utilisateur" — only for accounts with the `users.manage`
 * permission (registration is invite-only). */
function InviteLink() {
  const { user } = useAuth();
  if (!user || !hasPermission(user, 'users.manage')) return null;
  return (
    <Link to="/invite" className={itemCls}>
      <Icon d={INVITE} />
      Inviter un utilisateur
    </Link>
  );
}

/** Current account chip — avatar + name; clicking signs out (back to the
 * "Qui regarde ?" picker). Renders nothing until a session is hydrated. */
function UserChip() {
  const { user, switchProfile } = useAuth();
  if (!user) return null;
  return (
    <button
      type="button"
      onClick={switchProfile}
      className="mt-2 flex items-center gap-3 rounded-[11px] p-2.5 text-left transition-colors hover:bg-white/[.04]"
      title="Changer de profil"
    >
      <UserAvatar name={user.username} avatarUrl={user.avatarUrl} seed={user.id} size={36} radius={9} />
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-text">{user.username}</div>
        <div className="text-[11px] font-medium text-dim">Changer de profil</div>
      </div>
    </button>
  );
}
