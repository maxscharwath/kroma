import { useT } from '@kroma/ui';
import { Box, Txt, useFocusNav } from '@kroma/ui/kit';
import { useAuth } from '#tv/app/providers/auth';
import { useConnection } from '#tv/app/providers/connection';
import { useNav } from '#tv/app/router';
import { actionItem } from '#tv/app/settings/items';
import { PROFILE_SETTINGS, quitAppItem } from '#tv/app/settings/registry';
import { AuthScreen, ProfileAvatar } from '#tv/shared/ui';
import { SettingsRows } from './SettingsRows';

/** Profile menu (route `profileMenu`): the shared settings block
 * (PROFILE_SETTINGS: language, keyboard, engine, GPU) followed by the
 * account rows built inline - PIN, change profile, sign out, quit. Removing a
 * server happens by signing its profiles out, not from here. Every stateful
 * hook lives inside SettingsRows' row components, so the `!user` early return
 * below can't break hook order. */
export function TvProfileMenu() {
  const nav = useNav();
  const t = useT();
  const { activeServerUrl, client } = useConnection();
  const { user, switchProfile, logout, forget } = useAuth();
  useFocusNav({ onBack: nav.back });

  if (!user) return null;

  const onSignOut = () => {
    if (activeServerUrl) forget(user.id, activeServerUrl);
    else void logout();
  };

  const rows = [
    ...PROFILE_SETTINGS,
    actionItem({
      id: 'pin',
      icon: 'lock',
      label: user.hasPin ? 'profileMenu.removePin' : 'profileMenu.setPin',
      badge: user.hasPin
        ? { label: 'profileMenu.on', tone: 'success' as const }
        : { label: 'profileMenu.off', tone: 'dim' as const },
      run: () => nav.go('pin', { intent: user.hasPin ? 'clear' : 'set' }),
    }),
    actionItem({
      id: 'changeProfile',
      icon: 'users-group',
      label: 'nav.changeProfile',
      run: switchProfile,
    }),
    actionItem({ id: 'signOut', icon: 'logout', label: 'auth.logout', run: onSignOut }),
    quitAppItem,
  ];

  return (
    <AuthScreen>
      <Box align="center" gap={14} mb={32}>
        <ProfileAvatar
          name={user.username}
          seed={user.id}
          size={96}
          radius={26}
          src={client?.resolveArt(user.avatarUrl)}
        />
        <Txt variant="h1" style={{ fontSize: 32, fontWeight: '600' }}>
          {user.username}
        </Txt>
      </Box>

      <Box w="100%" maxW={560} gap={12}>
        <SettingsRows items={rows} />
      </Box>

      <Txt
        style={{ fontSize: 14, fontWeight: '500', marginTop: 28 }}
        color="rgba(244, 243, 240, 0.4)"
      >
        {t('profileMenu.navHint')}
      </Txt>
    </AuthScreen>
  );
}
