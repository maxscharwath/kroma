// A TMDB discovery result as a poster tile: real art or gradient and an
// availability/request chip, wearing the same hover action bar a library poster
// does. The bar carries request (when the title is unowned and unrequested)
// alongside watched and bookmark, so a card needs no separate request button.
// Clicks route to the local fiche when owned, else the discover detail.

import { type DiscoverEntry, posterColors, sizedImageUrl } from '@kroma/core';
import { useT } from '@kroma/ui';
import {
  Box,
  color,
  Focusable,
  gradient,
  Icon,
  IconButton,
  If,
  Img,
  Row,
  styles,
  Text,
} from '@kroma/ui/kit';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useAuth } from '#web/shared/lib/auth';
import { useMyList } from '#web/shared/lib/mylist';
import { useWatched } from '#web/shared/lib/watched';
import { PosterActionBar } from '#web/shared/ui/poster-action-bar';
import { RequestStatusChip } from '#web/shared/ui/request-status-chip';

// A touch screen has no hover, so what a pointer reveals is always up there.
const COARSE =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

const s = styles({
  tile: { w: '100%' },
  art: { aspect: 2 / 3, radius: 'lg', overflow: 'hidden', shadow: 'card' },
  artLit: { shadow: 'pop' },
  overlay: { opacity: 0, pointerEvents: 'none' },
  overlayLit: { opacity: 1 },
});

export function DiscoverCard({ entry, width }: Readonly<{ entry: DiscoverEntry; width?: number }>) {
  const t = useT();
  const navigate = useNavigate();
  const { client } = useAuth();
  const { isWatched, toggleWatched } = useWatched();
  const { inList, toggle: toggleMyList } = useMyList();
  const [imgOk, setImgOk] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState(entry.requestStatus);
  const [c1, c2] = posterColors(String(entry.tmdbId));
  const art = sizedImageUrl(entry.posterUrl, width ?? 208);
  const showImg = Boolean(art) && imgOk;
  const owned = entry.inLibrary && entry.localId;
  const canRequest = !owned && !optimisticStatus;
  // Watched and bookmark use one id for both owned and discover titles: the
  // local item id when owned, else `tmdb:<id>` so membership survives a library
  // rescan — which is what lets a not-yet-available title be bookmarked.
  const listId = owned ? (entry.localId ?? '') : `tmdb:${entry.tmdbId}`;
  const tint = `linear-gradient(158deg, ${c1} 0%, ${c2} 70%)`;

  let statusChip: ReactNode = null;
  if (owned) {
    statusChip = <RequestStatusChip status="available" size="card" />;
  } else if (optimisticStatus) {
    statusChip = (
      <RequestStatusChip status={optimisticStatus} size="card" progress={entry.requestProgress} />
    );
  }

  const open = () => {
    if (owned) {
      navigate({
        to: entry.kind === 'show' ? '/show/$id' : '/movie/$id',
        params: { id: entry.localId ?? '' },
      });
    } else {
      navigate({
        to: '/discover/$type/$tmdbId',
        params: { type: entry.kind === 'show' ? 'tv' : 'movie', tmdbId: String(entry.tmdbId) },
      });
    }
  };

  const request = () => {
    if (requesting) return;
    setRequesting(true);
    client
      .createRequest({ kind: entry.kind, tmdbId: entry.tmdbId, seasons: null })
      .then((req) => setOptimisticStatus(req.status))
      .catch(() => undefined)
      .finally(() => setRequesting(false));
  };

  return (
    <div className="poster-frame" style={{ width: width ?? 'var(--card-w)', flexShrink: 0 }}>
      <Focusable label={entry.title} onPress={open} focusScale={1.03} style={s.tile}>
        {(state) => {
          const lit = COARSE || state.hovered || state.focused;
          return (
            <Box style={[s.art, lit ? s.artLit : null]}>
              {showImg ? (
                <Img
                  src={art}
                  alt={entry.title}
                  background={tint}
                  radius="lg"
                  fill
                  onError={() => setImgOk(false)}
                />
              ) : (
                <Box fill justify="flex-end" p={12} radius="lg" style={gradient(tint)}>
                  <Text variant="label" color="white/90" lines={3}>
                    {entry.title}
                  </Text>
                </Box>
              )}

              {/* top gradient scrim keeps the chips legible over bright art */}
              <Box
                absolute
                left={0}
                right={0}
                top={0}
                h={64}
                style={[s.overlay, lit ? s.overlayLit : null, TOP_SCRIM]}
              />

              <Box absolute left={8} top={8} gap={6}>
                {statusChip}
              </Box>

              <PosterActionBar>
                <If condition={canRequest}>
                  <IconButton icon="download" label={t('discover.request')} onPress={request} />
                </If>
                <IconButton
                  icon={isWatched(listId) ? 'eye-filled' : 'eye'}
                  label={t('discover.markWatched')}
                  onPress={() => toggleWatched(listId)}
                />
                <IconButton
                  icon={inList(listId) ? 'bookmark-filled' : 'bookmark'}
                  label={t('discover.addToMyList')}
                  onPress={() => toggleMyList(listId)}
                />
              </PosterActionBar>
            </Box>
          );
        }}
      </Focusable>
      <Box mt={8} px={2}>
        <Text variant="label" lines={1}>
          {entry.title}
        </Text>
        <Row gap={6} mt={2} align="center">
          {entry.rating ? (
            <>
              <Row gap={3} align="center">
                <Icon name="star-filled" size={10} color="accent" />
                <Text variant="meta" color="accent">
                  {entry.rating.toFixed(1)}
                </Text>
              </Row>
              <Text variant="meta" color="white/20">
                ·
              </Text>
            </>
          ) : null}
          <Text variant="meta" color="textDim">
            {entry.kind === 'show' ? t('discover.kindShow') : t('discover.kindMovie')}
          </Text>
          {entry.year ? (
            <>
              <Text variant="meta" color="white/20">
                ·
              </Text>
              <Text variant="meta" color="textDim">
                {entry.year}
              </Text>
            </>
          ) : null}
        </Row>
      </Box>
    </div>
  );
}

const TOP_SCRIM = gradient(`linear-gradient(to bottom, ${color('black/55')}, transparent)`);
