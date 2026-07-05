// The request-flow detail page for a TMDB title not (fully) in the library:
// a cinematic hero (Request / status / View-in-library CTA), the show's season
// picker, plus the cast + similar rails the in-library fiches carry.

import { apiErrorText, type DiscoverDetail, type DiscoverEntry } from '@luma/core';
import { useT } from '@luma/ui';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { CastRail, type SimilarItem, SimilarRail } from '#web/features/catalog/detail';
import { DiscoverHero } from '#web/features/requests/DiscoverHero';
import { DiscoverSeasons } from '#web/features/requests/DiscoverSeasons';
import { SeasonPicker } from '#web/features/requests/SeasonPicker';
import { imageUrl } from '#web/shared/lib/api';
import { useAuth } from '#web/shared/lib/auth';

export function DiscoverDetailView({ initial }: Readonly<{ initial: DiscoverDetail }>) {
  const t = useT();
  const { client } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(initial);
  const [busy, setBusy] = useState(false);
  // `null` = closed; `number[]` = open with that preselection ([] preselects
  // every open season, a singleton preselects one clicked season).
  const [pick, setPick] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kindLabel = t(detail.kind === 'show' ? 'discover.kindShow' : 'discover.kindMovie');
  const similar = useMemo<SimilarItem[]>(
    () =>
      detail.similar.map((e) => ({
        id: String(e.tmdbId),
        title: e.title,
        genre: kindLabel,
        badge: null,
        poster: imageUrl(e.posterUrl) ?? '',
      })),
    [detail.similar, kindLabel],
  );

  const doRequest = (seasons: number[] | null) => {
    setBusy(true);
    setError(null);
    client
      .createRequest({ kind: detail.kind, tmdbId: detail.tmdbId, seasons })
      .then((req) => {
        setDetail((d) => {
          // Flip the just-requested seasons so their cards show the chip without
          // a reload (`null` = every still-open season).
          const target = new Set(
            seasons ?? d.seasons.filter((s) => !s.available && !s.requested).map((s) => s.season),
          );
          return {
            ...d,
            requestId: req.id,
            requestStatus: req.status,
            seasons: d.seasons.map((s) => (target.has(s.season) ? { ...s, requested: true } : s)),
          };
        });
        setPick(null);
      })
      .catch((e) => setError(apiErrorText(e, t('discover.requestFailed'))))
      .finally(() => setBusy(false));
  };

  // Movies request immediately; shows open the season sheet.
  const onRequestClick = () => {
    if (detail.kind === 'show') setPick([]);
    else doRequest(null);
  };

  // A recommendation deep-links to its real fiche when owned, else its own
  // discovery page.
  const openSimilar = (e: DiscoverEntry) => {
    if (e.inLibrary && e.localId) {
      navigate({ to: e.kind === 'show' ? '/show/$id' : '/movie/$id', params: { id: e.localId } });
    } else {
      navigate({
        to: '/discover/$type/$tmdbId',
        params: { type: e.kind === 'show' ? 'tv' : 'movie', tmdbId: String(e.tmdbId) },
      });
    }
  };

  return (
    <main className="min-w-0 animate-[fade-in_.4s_ease] pb-16">
      <DiscoverHero
        detail={detail}
        busy={busy}
        error={error}
        onBack={() => navigate({ to: '/search' })}
        onRequest={onRequestClick}
        onViewLibrary={() =>
          navigate({
            to: detail.kind === 'show' ? '/show/$id' : '/movie/$id',
            params: { id: detail.localId ?? '' },
          })
        }
      />

      {detail.kind === 'show' ? (
        <DiscoverSeasons
          seasons={detail.seasons}
          onPickAll={() => setPick([])}
          onPickOne={(season) => setPick([season])}
        />
      ) : null}

      <CastRail cast={detail.cast} />

      <SimilarRail
        title={t('content.similarTitles')}
        items={similar}
        onOpen={(id) => {
          const entry = detail.similar.find((e) => String(e.tmdbId) === id);
          if (entry) openSimilar(entry);
        }}
      />

      {pick !== null ? (
        <SeasonPicker
          detail={detail}
          busy={busy}
          initial={pick.length > 0 ? pick : undefined}
          onClose={() => setPick(null)}
          onRequest={doRequest}
        />
      ) : null}
    </main>
  );
}
