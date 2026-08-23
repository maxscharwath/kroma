// A TMDB discovery result as a poster tile: real art or gradient, overlaid
// rating + availability/request chip, and a hover "request" affordance.
// Clicks route to the local fiche when owned, else the discover detail.
// The "+" overlay requests in-place on web (stopPropagation prevents the
// card navigation); on TV the card still opens the detail page.

import { type DiscoverEntry, posterColors, sizedImageUrl } from '@kroma/core';
import { useT } from '@kroma/ui';
import {
  Box,
  backdropBlur,
  color,
  Focusable,
  gradient,
  Icon,
  Img,
  Row,
  styles,
  Text,
} from '@kroma/ui/kit';
import { useNavigate } from '@tanstack/react-router';
import { type CSSProperties, type ReactNode, useState } from 'react';
import { useAuth } from '#web/shared/lib/auth';
import { useMyList } from '#web/shared/lib/mylist';
import { useWatchLater } from '#web/shared/lib/watch-later';
import { useWatched } from '#web/shared/lib/watched';
import { RequestStatusChip } from '#web/shared/ui/request-status-chip';

const RATING_PILL = backdropBlur(4);
const RATING_LABEL = { fontSize: 10.5, fontWeight: '700' } as const;
const REQUEST_LABEL = { fontSize: 12.5, fontWeight: '700' } as const;

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
  const { inQueue, toggle: toggleWatchLater } = useWatchLater();
  const [imgOk, setImgOk] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState(entry.requestStatus);
  const [c1, c2] = posterColors(String(entry.tmdbId));
  const art = sizedImageUrl(entry.posterUrl, width ?? 208);
  const showImg = Boolean(art) && imgOk;
  const owned = entry.inLibrary && entry.localId;
  const localId = entry.localId ?? '';
  const queueId = owned ? localId : `tmdb:${entry.tmdbId}`;
  const canRequest = !owned && !optimisticStatus;
  // All three list actions use queueId so they work for both owned and
  // discover titles. Owned titles use their local item id; discover titles
  // use `tmdb:<id>` so membership survives a library rescan.
  const listId = queueId;
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

  const requestInPlace = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (requesting) return;
    setRequesting(true);
    client
      .createRequest({ kind: entry.kind, tmdbId: entry.tmdbId, seasons: null })
      .then((req) => setOptimisticStatus(req.status))
      .catch(() => undefined)
      .finally(() => setRequesting(false));
  };

  return (
    <div style={{ width: width ?? 'var(--card-w)', flexShrink: 0 }}>
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

              {entry.rating ? (
                <Row
                  absolute
                  top={8}
                  right={8}
                  gap={2}
                  px={6}
                  py={2}
                  radius="pill"
                  bg="black/55"
                  style={RATING_PILL}
                >
                  <Icon name="star-filled" size={9} color="accent" />
                  <Text color="accent" style={RATING_LABEL}>
                    {entry.rating.toFixed(1)}
                  </Text>
                </Row>
              ) : null}

              {canRequest ? (
                <button
                  type="button"
                  onClick={requestInPlace}
                  disabled={requesting}
                  aria-label={t('discover.request')}
                  style={
                    {
                      ...CTA_BUTTON,
                      backgroundImage: CTA_SCRIM_CSS,
                      opacity: lit ? 1 : 0,
                      pointerEvents: lit ? 'auto' : 'none',
                    } as CSSProperties
                  }
                >
                  {requesting ? (
                    <Icon name="loader-2" size={14} color="white" />
                  ) : (
                    <Icon name="plus" size={14} thickness={2.6} color="white" />
                  )}
                  <Text color="white" style={REQUEST_LABEL}>
                    {requesting ? t('discover.requesting') : t('discover.request')}
                  </Text>
                </button>
              ) : null}

              {owned || !canRequest ? (
                <div
                  style={
                    {
                      position: 'absolute',
                      right: 8,
                      bottom: 8,
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 6,
                      opacity: lit ? 1 : 0,
                      pointerEvents: lit ? 'auto' : 'none',
                      zIndex: 2,
                    } as CSSProperties
                  }
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatched(listId);
                    }}
                    aria-label={t('discover.markWatched')}
                    style={QUICK_ACTION_BTN}
                  >
                    <Icon
                      name={isWatched(listId) ? 'check' : 'eye'}
                      size={16}
                      color={isWatched(listId) ? 'accent' : 'white'}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMyList(listId);
                    }}
                    aria-label={t('discover.addToMyList')}
                    style={QUICK_ACTION_BTN}
                  >
                    <Icon
                      name={inList(listId) ? 'check' : 'plus'}
                      size={16}
                      color={inList(listId) ? 'accent' : 'white'}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatchLater(listId);
                    }}
                    aria-label={t('discover.watchLater')}
                    style={QUICK_ACTION_BTN}
                  >
                    <Icon
                      name={inQueue(listId) ? 'bookmark-filled' : 'bookmark'}
                      size={16}
                      color={inQueue(listId) ? 'accent' : 'white'}
                    />
                  </button>
                </div>
              ) : null}
            </Box>
          );
        }}
      </Focusable>
      <Box mt={8} px={2}>
        <Text variant="label" lines={1}>
          {entry.title}
        </Text>
        <Row gap={6} mt={2}>
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

const CTA_SCRIM_CSS = `linear-gradient(to top, ${color('black/75')}, transparent)`;

const QUICK_ACTION_BTN = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 'none',
  background: color('black/55'),
  cursor: 'pointer',
  backdropFilter: 'blur(4px)',
} as const;

const CTA_BUTTON = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  paddingTop: 32,
  paddingBottom: 12,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  pointerEvents: 'auto',
} as const;
