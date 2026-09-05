import type { ItemId } from '@kroma/core';
import { useT } from '@kroma/ui';
import { Box, Button, color, Progress, Text } from '@kroma/ui/kit';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { catalogQueries, toTrailerView } from '#web/shared/lib/queries';

type Clip = ReturnType<typeof toTrailerView>;

const CURTAIN = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  background: color('black'),
} as const;

/** Holds the screen while the server fetches the clip, then hands the player an
 * item that already knows its length. Mounting the player any earlier gives it
 * a stream URL that answers 404 and a scrub bar with nothing to size against. */
export function TrailerGate({ id, children }: { id: ItemId; children: (clip: Clip) => ReactNode }) {
  const t = useT();
  const { data: item } = useSuspenseQuery(catalogQueries.item(id));
  const clip = useQuery(catalogQueries.trailer(id));

  if (clip.isError) return <Curtain message={t('player.trailerUnavailable')} />;
  if (!clip.data || clip.data.state === 'preparing') {
    return <Curtain message={t('player.trailerPreparing')} percent={clip.data?.percent ?? 0} />;
  }
  return children(toTrailerView(item, clip.data));
}

function Curtain({ message, percent }: { message: string; percent?: number }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div style={CURTAIN}>
      <Text variant="body">{message}</Text>
      {percent === undefined ? (
        <Button variant="glass" onPress={() => navigate({ to: '/', replace: true })}>
          {t('player.back')}
        </Button>
      ) : (
        <Box w={280}>
          <Progress value={percent / 100} label={message} waiting={percent === 0} />
        </Box>
      )}
    </div>
  );
}
