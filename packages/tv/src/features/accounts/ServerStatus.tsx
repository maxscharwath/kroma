import { useT } from '@kroma/ui';
import { Box, colors, Txt } from '@kroma/ui/kit';
import type { ServerProbe } from '#tv/app/useServersHealth';

/** Server-reachability dot shared by the profile picker and the add-profile
 * server list: green when up, red when down, a quiet grey while the first probe
 * is still pending (`online === undefined`). */
export function StatusDot({ online }: Readonly<{ online?: boolean }>) {
  const look = lookOf(online);
  return <Box w={10} h={10} shrink={0} radius="pill" bg={look.bg} style={look.glow} />;
}

/** The dot plus what the probe measured: the round-trip while the server
 * answers, "Injoignable" when it doesn't, "Vérification…" until the first
 * answer. Round-trip rather than a bare "En ligne" because on a LAN list it is
 * the one number that separates two live servers. */
export function ServerStatusPill({ probe }: Readonly<{ probe?: ServerProbe }>) {
  const t = useT();
  const online = probe?.online;
  let label = t('addProfile.checking');
  if (online === false) label = t('addProfile.unreachable');
  else if (probe?.latencyMs !== undefined) label = `${probe.latencyMs} ms`;
  else if (online) label = t('addProfile.reachable');

  return (
    <Box row align="center" gap={8} shrink={0}>
      <StatusDot online={online} />
      <Txt style={LABEL} color={online === false ? 'danger' : 'rgba(244, 243, 240, 0.55)'}>
        {label}
      </Txt>
    </Box>
  );
}

function lookOf(online?: boolean) {
  if (online === undefined) return PENDING;
  return online ? UP : DOWN;
}

const LABEL = { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.26 };

const PENDING = { bg: 'rgba(255, 255, 255, 0.25)', glow: null };
const UP = { bg: colors.success, glow: { boxShadow: '0 0 7px rgba(70, 208, 141, 0.75)' } };
const DOWN = { bg: colors.danger, glow: { boxShadow: '0 0 7px rgba(229, 57, 53, 0.75)' } };
