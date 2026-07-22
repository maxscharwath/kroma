import { useT } from '@kroma/ui';
import { Box, Chip, Focusable, gradient, Icon, Spinner, Txt } from '@kroma/ui/kit';
import { useAuth } from '#tv/app/providers/auth';
import { useConnection } from '#tv/app/providers/connection';
import { useNav } from '#tv/app/router';
import { KromaMark, ProfileAvatar, TvBackButton, useClock } from '#tv/shared/ui';

export type NavKey = 'home' | 'films' | 'series' | 'genres' | 'mylist' | 'search';

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

  const items: { key: NavKey; label: string; search?: boolean; go: () => void }[] = [
    { key: 'home', label: t('nav.home'), go: () => nav.home() },
    { key: 'films', label: t('nav.films'), go: () => nav.reset('grid', { kind: 'films' }) },
    { key: 'series', label: t('nav.series'), go: () => nav.reset('grid', { kind: 'series' }) },
    { key: 'genres', label: t('nav.genres'), go: () => nav.reset('genres') },
    { key: 'mylist', label: t('nav.myList'), go: () => nav.reset('grid', { kind: 'mylist' }) },
    { key: 'search', label: t('nav.search'), search: true, go: () => nav.reset('search') },
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
      <Box row align="center" between>
        {/* Back (mouse users): shown on any pushed screen, hidden on Home (root). */}
        <Box row align="center" gap={16}>
          <TvBackButton />
          <KromaMark size={28} />
        </Box>
        {/* Solid translucent fill, no backdrop blur: Tizen composites blur on the
            CPU and it costs visible frames on every scroll / focus move. */}
        <Box
          row
          align="center"
          gap={4}
          p={6}
          radius="pill"
          border="border"
          bg="rgba(10, 10, 12, 0.78)"
        >
          {items.map((n) => (
            <Chip
              key={n.key}
              variant="subtle"
              size="tv"
              focusScale={1.04}
              active={n.key === active}
              icon={n.search ? 'search' : undefined}
              label={n.label}
              onPress={n.go}
              style={NAV_CHIP}
            />
          ))}
        </Box>
        <Box row align="center" gap={18}>
          <ConnectionStatus online={online} label={t('connection.reconnecting')} />
          <Txt style={CLOCK}>{clock}</Txt>
          {user ? (
            <Focusable
              onPress={() => nav.go('profileMenu')}
              label={user.username}
              focusScale={1.08}
              style={{ borderRadius: 11 }}
            >
              <ProfileAvatar
                name={user.username}
                seed={user.id}
                size={44}
                radius={11}
                src={client?.resolveArt(user.avatarUrl)}
              />
            </Focusable>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

// The nav pill sits inside its own rounded container, so its chips run tighter
// than the standalone `tv` chip and carry no border of their own.
const NAV_CHIP = { paddingVertical: 9, paddingHorizontal: 20, borderWidth: 0 } as const;

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
