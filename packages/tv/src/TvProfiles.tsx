import {
  type AuthResult,
  LOCALES,
  type LumaClient,
  type MessageKey,
  normalizeServerUrl as norm,
  type QuickConnectInit,
  type StoredSession,
} from '@luma/core';
import { useLocale, useSetLocale, useT } from '@luma/ui';
import {
  IconChevronRight,
  IconLanguage,
  IconLock,
  IconLogout,
  IconPlus,
  IconTrash,
  IconUsersGroup,
} from '@tabler/icons-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuth } from '#tv/auth';
import { useConnection } from '#tv/connection';
import { useNav } from '#tv/router';
import { artUrl, AuthScreen, hostOf, LumaMark, ProfileAvatar } from '#tv/ui';
import { useFocusNav } from '#tv/useFocusNav';

// Small palette for the per-server colour dot on each profile tile.
const SERVER_DOTS = ['#F4B642', '#3BC9DB', '#A855F7', '#46D08D', '#F472B6', '#86A8FF'];
function serverColor(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i += 1) h = (h * 31 + url.charCodeAt(i)) >>> 0;
  return SERVER_DOTS[h % SERVER_DOTS.length] as string;
}

interface Tile {
  key: string;
  account: StoredSession;
  serverName: string;
}

/**
 * Profile picker — the signed-out home. It shows ONLY the profiles paired on this
 * device (remembered accounts); it never lists the server's other accounts and
 * makes no request on open. A PIN-protected profile routes to the PIN screen, the
 * rest sign in instantly. "Ajouter un profil" opens the wizard to pair a new one.
 */
export function TvProfiles() {
  const nav = useNav();
  const t = useT();
  const { servers, activeServerName } = useConnection();
  const { accounts, activate, isUnlocked } = useAuth();

  const tiles = useMemo<Tile[]>(() => {
    const nameFor = (url: string) =>
      servers.find((s) => s.url === norm(url))?.name ||
      hostOf(norm(url)) ||
      (activeServerName ?? 'LUMA');
    return accounts.map((a) => ({
      key: `${norm(a.serverUrl)}|${a.user.id}`,
      account: a,
      serverName: nameFor(a.serverUrl ?? ''),
    }));
  }, [accounts, servers, activeServerName]);

  useFocusNav({ onBack: nav.back, resetKey: tiles.length });

  const onSelect = (a: StoredSession) => {
    const locked = a.user.hasPin && !isUnlocked(a);
    if (locked) nav.go('pin', { intent: 'verify', account: a });
    else activate(a);
  };

  return (
    <AuthScreen>
      <div className="mb-7">
        <LumaMark size={34} />
      </div>
      <h1 className="m-0 mb-3 font-display text-[50px] font-semibold leading-none">
        {t('auth.whoWatching')}
      </h1>
      <p className="m-0 mb-11 font-sans text-[17px] font-medium text-dim">
        {t('profiles.subtitle')}
      </p>

      {/* No own scroll/clip — the page (AuthScreen) scrolls, so focus zoom + the
          amber ring/glow are never cropped. Gutters keep edge tiles' rings clear. */}
      <div className="flex w-full max-w-[1100px] flex-wrap content-start items-start justify-center gap-x-7 gap-y-9 px-6 py-4">
        {tiles.map(({ key, account, serverName }) => (
          <div key={key} className="flex w-[150px] flex-col items-center gap-3">
            <button
              data-focus=""
              type="button"
              onClick={() => onSelect(account)}
              className="relative cursor-pointer rounded-3xl border-none bg-transparent p-0 outline-none transition-transform focus:scale-[1.07]"
            >
              <ProfileAvatar
                name={account.user.username}
                seed={account.user.id}
                size={146}
                radius={24}
                src={artUrl(norm(account.serverUrl), account.user.avatarUrl)}
                locked={account.user.hasPin}
              />
            </button>
            <div className="flex flex-col items-center gap-1.25">
              <span className="font-sans text-[18px] font-medium text-[rgba(244,243,240,0.82)]">
                {account.user.username}
              </span>
              <span className="inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold text-[rgba(244,243,240,0.42)]">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: serverColor(norm(account.serverUrl)) }}
                />
                {serverName}
              </span>
            </div>
          </div>
        ))}

        <div className="flex w-[150px] flex-col items-center gap-3">
          <button
            data-focus=""
            type="button"
            onClick={() => nav.go('addProfile')}
            className="flex h-[146px] w-[146px] cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed border-[rgba(255,255,255,0.18)] bg-transparent text-[rgba(255,255,255,0.35)] outline-none transition-transform focus:scale-[1.07] focus:border-accent focus:text-accent"
          >
            <IconPlus size={46} stroke={1.6} />
          </button>
          <span className="font-sans text-[18px] font-medium text-[rgba(244,243,240,0.5)]">
            {t('profiles.addProfile')}
          </span>
        </div>
      </div>

      <div className="mt-9 flex items-center gap-4 font-sans text-[14px] font-semibold tracking-[0.03em] text-[rgba(244,243,240,0.4)]">
        {t('profiles.navHint')}
      </div>
    </AuthScreen>
  );
}

/**
 * Quick Connect (route `quick`) against the active server: shows a code + QR; an
 * already-signed-in user approves it from the web/mobile app and the TV pairs the
 * profile on its next poll — no password typed on the remote.
 */
export function TvQuickConnect() {
  const nav = useNav();
  const t = useT();
  const { client, activeServerUrl, activeServerName } = useConnection();
  const { login } = useAuth();
  const [info, setInfo] = useState<QuickConnectInit | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | ''>('');
  useFocusNav({ onBack: nav.back });

  useEffect(() => {
    if (!client || !activeServerUrl) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let secret = '';

    const onAuthenticated = (res: AuthResult) => login(res, activeServerUrl);

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
        const url = connectUrl(client, init.code, init.authorizeUrl);
        if (url) {
          void import('qrcode-generator')
            .then((mod) => {
              if (cancelled) return;
              const qrc = mod.default(0, 'M');
              qrc.addData(url);
              qrc.make();
              setQr(qrc.createSvgTag({ cellSize: 6, margin: 1, scalable: true }));
            })
            .catch(() => undefined);
        }
        timer = setTimeout(poll, 2500);
      } catch {
        if (!cancelled) setError('connect.quickConnectUnavailable');
      }
    };

    void begin();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, activeServerUrl, login]);

  return (
    <AuthScreen>
      <div className="mb-9">
        <LumaMark size={40} />
      </div>
      <h1 className="m-0 mb-4 font-display text-[44px] font-semibold leading-none">
        {t('connect.quickConnect')}
      </h1>
      <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-border bg-[rgba(255,255,255,0.05)] px-4 py-2.25">
        <span className="h-2 w-2 rounded-full bg-accent" />
        <span className="font-sans text-[15px] font-semibold text-[rgba(244,243,240,0.88)]">
          {activeServerName ?? 'LUMA'}
        </span>
      </div>

      {error ? <p className="font-sans text-[16px] text-danger">{t(error)}</p> : null}

      {!error && info ? (
        <>
          {qr ? (
            <div
              className="flex h-[280px] w-[280px] items-center justify-center rounded-[28px] bg-white p-5 shadow-pop [&>svg]:h-full [&>svg]:w-full"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          ) : null}
          <div className="mt-5 font-sans text-[17px] font-medium text-dim">
            {t('connect.scanQrConnected')}
          </div>
          <div className="mt-6 font-sans text-[17px] font-medium text-muted">
            {t('connect.orInAppPrefix')}
            <b className="text-text">{t('nav.connectDevice')}</b>
            {t('connect.orInAppSuffix')}
          </div>
          <div className="mt-5 flex gap-7 font-display text-[96px] font-bold leading-none text-accent tabular-nums">
            {info.code}
          </div>
          <div className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-[rgba(70,208,141,0.25)] bg-[rgba(70,208,141,0.1)] px-4.5 py-2.5">
            <span className="h-2.25 w-2.25 rounded-full bg-success animate-[tv-breathe_1.6s_ease-in-out_infinite]" />
            <span className="font-sans text-[14px] font-semibold text-success">
              {t('connect.waitingApproval')}
            </span>
          </div>
        </>
      ) : null}
      {!error && !info ? (
        <div className="h-10 w-10 rounded-full border-[3px] border-[rgba(255,255,255,0.2)] border-t-accent animate-[tvp-spin_0.9s_linear_infinite]" />
      ) : null}

      <p className="mt-6 font-sans text-[15px] font-medium text-dim">
        {t('connect.backToProfiles')}
      </p>
    </AuthScreen>
  );
}

/** Resolve the web `/connect?code=` URL for the QR. */
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

// ----- profile menu -----------------------------------------------------------

const MENU_ROW =
  'flex w-full items-center gap-4 rounded-[15px] border border-border bg-[rgba(255,255,255,0.03)] px-5 py-4 text-left outline-none transition-transform focus:scale-[1.02] focus:border-accent';

/** Profile menu (route `profileMenu`): the signed-in account's settings —
 * language, PIN, switch profile, sign out, and forget-this-server. */
export function TvProfileMenu() {
  const nav = useNav();
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { activeServerUrl, forgetServer, client } = useConnection();
  const { user, switchProfile, logout, forget } = useAuth();
  useFocusNav({ onBack: nav.back });
  if (!user) return null;

  const cycleLocale = () => {
    const i = LOCALES.findIndex((l) => l.code === locale);
    const next = LOCALES[(i + 1) % LOCALES.length]!;
    setLocale(next.code);
  };
  const localeLabel = LOCALES.find((l) => l.code === locale)?.labelKey;

  const onForgetServer = () => {
    if (activeServerUrl) {
      switchProfile();
      forgetServer(activeServerUrl);
    }
  };
  const onSignOut = () => {
    if (activeServerUrl) forget(user.id, activeServerUrl);
    else void logout();
  };

  return (
    <AuthScreen>
      <div className="mb-8 flex flex-col items-center gap-3.5">
        <ProfileAvatar
          name={user.username}
          seed={user.id}
          size={96}
          radius={26}
          src={client?.resolveArt(user.avatarUrl)}
        />
        <h1 className="m-0 font-display text-[32px] font-semibold">{user.username}</h1>
      </div>

      <div className="flex w-full max-w-[560px] flex-col gap-3">
        <MenuRow
          icon={<IconLanguage size={22} stroke={1.7} />}
          label={t('common.language')}
          onAct={cycleLocale}
        >
          <span className="font-sans text-[16px] font-semibold text-accent">
            {localeLabel ? t(localeLabel) : locale}
          </span>
        </MenuRow>

        {user.hasPin ? (
          <MenuRow
            icon={<IconLock size={22} stroke={1.7} />}
            label={t('profileMenu.removePin')}
            onAct={() => nav.go('pin', { intent: 'clear' })}
          >
            <span className="font-sans text-[15px] font-semibold text-success">
              {t('profileMenu.on')}
            </span>
          </MenuRow>
        ) : (
          <MenuRow
            icon={<IconLock size={22} stroke={1.7} />}
            label={t('profileMenu.setPin')}
            onAct={() => nav.go('pin', { intent: 'set' })}
          >
            <span className="font-sans text-[15px] font-semibold text-dim">
              {t('profileMenu.off')}
            </span>
          </MenuRow>
        )}

        <MenuRow
          icon={<IconUsersGroup size={22} stroke={1.7} />}
          label={t('nav.changeProfile')}
          onAct={switchProfile}
        />
        <MenuRow
          icon={<IconLogout size={22} stroke={1.7} />}
          label={t('auth.logout')}
          onAct={onSignOut}
        />
        <MenuRow
          icon={<IconTrash size={22} stroke={1.7} />}
          label={t('profileMenu.forgetServer')}
          onAct={onForgetServer}
          danger
        />
      </div>

      <div className="mt-7 font-sans text-[14px] font-medium text-[rgba(244,243,240,0.4)]">
        {t('profileMenu.navHint')}
      </div>
    </AuthScreen>
  );
}

function MenuRow({
  icon,
  label,
  onAct,
  children,
  danger = false,
}: Readonly<{
  icon: ReactNode;
  label: string;
  onAct: () => void;
  children?: ReactNode;
  danger?: boolean;
}>) {
  return (
    <button data-focus="" type="button" onClick={onAct} className={MENU_ROW}>
      <span
        className={`flex h-10.5 w-10.5 flex-none items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] ${
          danger ? 'text-danger' : 'text-muted'
        }`}
      >
        {icon}
      </span>
      <span
        className={`flex-1 font-sans text-[18px] font-bold ${danger ? 'text-danger' : 'text-text'}`}
      >
        {label}
      </span>
      {children ?? <IconChevronRight size={20} className="text-dim" />}
    </button>
  );
}
