// The player screen: full-screen expo-video surface + Kroma chrome. Locks
// landscape on phones, keeps the screen awake, resumes from saved progress,
// reports the playback heartbeat, and autoplays the next episode on end. A
// trailer (`?trailer=1`) gets the same chrome and none of that.

import { asTrailerItem, ItemId } from '@kroma/core';
import { useQuery } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ErrorView, Loading } from '#mobile/components/ui';
import { useDownloads } from '#mobile/lib/downloads';
import { useT } from '#mobile/lib/i18n';
import { goBack, routeParam } from '#mobile/lib/nav';
import { useClient } from '#mobile/lib/session';
import { PlayerBody } from '#mobile/player/PlayerBody';

const RESUME_MIN_MS = 30_000;
const RESUME_NEAR_END_RATIO = 0.95;

function resumeSec(positionMs: number | undefined, durationMs: number | null): number {
  if (!positionMs || positionMs < RESUME_MIN_MS) return 0;
  if (durationMs && positionMs > durationMs * RESUME_NEAR_END_RATIO) return 0;
  return positionMs / 1000;
}

function wantsTrailer(flag: string | undefined): boolean {
  return flag === '1' || flag === 'true';
}

export default function PlayerRoute() {
  const { id, trailer } = useLocalSearchParams<{ id?: string; trailer?: string }>();
  const localId = routeParam(id);
  if (!localId) return <Redirect href="/" />;
  const itemId = ItemId.parse(localId);
  return wantsTrailer(trailer) ? <TrailerScreen id={itemId} /> : <PlayerScreen id={itemId} />;
}

function TrailerScreen({ id }: Readonly<{ id: ItemId }>) {
  const t = useT();
  const client = useClient();
  const router = useRouter();
  useKeepAwake();

  const item = useQuery({ queryKey: ['item', id], queryFn: () => client.media.item(id) });
  const ready = useQuery({
    queryKey: ['trailer', id],
    queryFn: () => client.media.prepareTrailer(id),
    retry: 0,
  });
  const clip = useMemo(
    () =>
      item.data && ready.data
        ? { item: asTrailerItem(item.data, ready.data), key: ready.data.key }
        : null,
    [item.data, ready.data],
  );

  if (item.isError || ready.isError)
    return (
      <ErrorView
        message={t('player.trailerUnavailable')}
        retryLabel={t('player.back')}
        onRetry={() => goBack(router)}
      />
    );
  if (!clip) return <Loading label={t('common.loading')} />;

  return <PlayerBody key={id} item={clip.item} startSec={0} trailerKey={clip.key} />;
}

function PlayerScreen({ id }: Readonly<{ id: ItemId }>) {
  // `start` (seconds) is set when playback is handed BACK from a TV: the remote
  // knows the exact position, which is better than the last persisted beat.
  const { start } = useLocalSearchParams<{ start?: string }>();
  const handedBack = start ? Number(start) : null;
  const t = useT();
  const client = useClient();
  useKeepAwake();

  const downloads = useDownloads();
  const dl = downloads.stateFor(id);
  const offline = dl.status === 'done' ? dl.entry : null;

  const item = useQuery({ ...client.query.media.item(id), enabled: !offline });
  const progress = useQuery({
    ...client.query.playback.itemProgress(id),
    staleTime: 0,
    retry: 0,
  });

  // A downloaded title plays from its on-device snapshot, network or not.
  if (offline) {
    return (
      <PlayerBody
        key={offline.itemId}
        item={offline.item}
        startSec={handedBack ?? resumeSec(progress.data?.positionMs, offline.item.durationMs)}
        localUri={offline.fileUri}
        offline={offline}
      />
    );
  }

  if (item.isPending || progress.isPending) return <Loading label={t('common.loading')} />;
  if (item.isError)
    return (
      <ErrorView
        // Dev builds say WHAT failed; release keeps the friendly copy.
        message={
          __DEV__ && item.error instanceof Error
            ? `${t('error.serverBody')}\n\n[dev] ${item.error.message}`
            : t('error.serverBody')
        }
        retryLabel={t('error.retry')}
        onRetry={() => item.refetch()}
      />
    );

  return (
    <PlayerBody
      key={item.data.id}
      item={item.data}
      startSec={handedBack ?? resumeSec(progress.data?.positionMs, item.data.durationMs)}
    />
  );
}
