import { useT } from '@kroma/ui';
import {
  Avatar,
  Box,
  Focusable,
  FocusRegion,
  gradient,
  Icon,
  Spinner,
  screenEntry,
  Txt,
} from '@kroma/ui/kit';
import { type ComponentRef, createRef } from 'react';
import type { View } from 'react-native';
import { useAuth } from '#tv/app/providers/auth';
import { useConnection } from '#tv/app/providers/connection';
import { useNav } from '#tv/app/router';
import { type NavItem, NavPill } from '#tv/features/catalog/home/NavPill';
import { KromaMark, TvBackButton, useClock } from '#tv/shared/ui';

export type NavKey = 'home' | 'films' | 'series' | 'genres' | 'mylist' | 'search';

/** The two ends of the bar's right-hand gap. The pill stops well short of the
 * avatar and the clock between them is not focusable, so a strict band search
 * runs out of candidates and the account menu cannot be reached at all - six
 * presses of Right and focus never left the search chip. Measured on an Apple
 * TV. Both sides are named so the crossing works in both directions. */
const navLastChip = createRef<ComponentRef<typeof View>>();
const navAvatar = createRef<ComponentRef<typeof View>>();

// Top scrim so the logo / clock / avatar stay readable over bright hero art (a
// sky, a snowy shot...): the hero veil only darkens left and bottom.
const SCRIM = 'linear-gradient(180deg, rgba(10,10,12,0.72), rgba(10,10,12,0.25) 45%, transparent)';

/** The shared 10-foot top bar: brand mark, a centred nav pill (Accueil / Films /
 * Séries / Ma liste / Rechercher), the clock and the account avatar (opens the
 * profile menu). Persistent chrome on the browse screens (Home, Grid, detail,
 * Person) for quick section jumps.
 *
 * `active` is optional: deep screens (detail / person) pass none, so nothing is
 * highlighted. */
export function TvTopNav({ active }: Readonly<{ active?: NavKey }>) {
  const nav = useNav();
  const t = useT();
  const clock = useClock();
  const { user } = useAuth();
  const { client, online } = useConnection();

  // Same glyph per section as the phone app's tab bar (Tabler home / movie /
  // device-tv / category / bookmark / search), so the two clients read alike.
  const items: NavItem[] = [
    { key: 'home', icon: 'home', label: t('nav.home'), onPress: () => nav.home() },
    {
      key: 'films',
      icon: 'movie',
      label: t('nav.films'),
      onPress: () => nav.reset('grid', { kind: 'films' }),
    },
    {
      key: 'series',
      icon: 'device-tv',
      label: t('nav.series'),
      onPress: () => nav.reset('grid', { kind: 'series' }),
    },
    { key: 'genres', icon: 'category', label: t('nav.genres'), onPress: () => nav.reset('genres') },
    {
      key: 'mylist',
      icon: 'bookmark',
      label: t('nav.myList'),
      onPress: () => nav.reset('grid', { kind: 'mylist' }),
    },
    { key: 'search', icon: 'search', label: t('nav.search'), onPress: () => nav.reset('search') },
  ];

  return (
    <Box absolute left={0} right={0} top={0} z={10} px={64} py={32}>
      <Box
        absolute
        left={0}
        right={0}
        top={0}
        h={144}
        pointerEvents="none"
        style={gradient(SCRIM)}
      />
      {/* The whole bar is one focus BAND, and that is what makes a centred pill
          reachable at all. A television moves focus in a straight line, so from
          a control at the bottom left there is nothing overhead and Up does
          nothing - but the band spans the full width, so every Up from anywhere
          below lands in it, whatever the screen puts underneath, and it hands
          focus to the chip you used last. One region here replaces a crossing on
          every screen that shows the bar. */}
      <FocusRegion style={BAND}>
        {/* Back (mouse users): shown on any pushed screen, hidden on Home. */}
        <Box row align="center" gap={16}>
          <TvBackButton />
          <KromaMark size={28} />
        </Box>
        <NavPill items={items} active={active} lastRef={navLastChip} lastNeighbours={TO_AVATAR} />
        <Box row align="center" gap={18}>
          <ConnectionStatus online={online} label={t('connection.reconnecting')} />
          <Txt style={CLOCK}>{clock}</Txt>
          {user ? (
            <Focusable
              ref={navAvatar}
              neighbours={FROM_AVATAR}
              onPress={() => nav.go('profileMenu')}
              label={user.username}
              focusScale={1.08}
              style={{ borderRadius: 11 }}
            >
              <Avatar
                name={user.username}
                seed={user.id}
                size={44}
                radius={11}
                src={client?.resolveArt(user.avatarUrl)}
              />
            </Focusable>
          ) : null}
        </Box>
      </FocusRegion>
    </Box>
  );
}

/** The band is laid out by its caller, so it has to be told to span the row. */
const BAND = {
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
} as const;

const TO_AVATAR = { right: navAvatar };
const FROM_AVATAR = { left: navLastChip, down: screenEntry };

const CLOCK = {
  fontSize: 17,
  fontWeight: '600' as const,
  fontVariant: ['tabular-nums' as const],
  textShadow: '0 1px 4px rgba(0, 0, 0, 0.6)',
};

/** Server-reachability indicator for the top bar. Online: a quiet green dot with
 * a dark halo so it reads over any hero art. Offline: a solid red badge holding a
 * wifi-off glyph, over a spinner that signals the automatic reconnect in
 * progress. Icon-only, no label: the state reads at a glance. */
function ConnectionStatus({ online, label }: Readonly<{ online: boolean; label: string }>) {
  if (online) {
    return <Box w={10} h={10} radius="pill" bg="success" style={ONLINE_DOT} />;
  }
  return (
    <Box w={36} h={36} center accessibilityLabel={label} accessibilityRole="progressbar">
      <Box absolute>
        <Spinner size={34} thickness={2} color="rgba(229, 57, 53, 0.8)" />
      </Box>
      <Box w={28} h={28} center radius="pill" bg="danger" style={OFFLINE_BADGE}>
        <Icon name="wifi-off" size={16} stroke={2.2} color="#FFFFFF" />
      </Box>
    </Box>
  );
}

const ONLINE_DOT = {
  boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.4), 0 0 8px rgba(70, 208, 141, 0.85)',
} as const;

const OFFLINE_BADGE = { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)' } as const;
