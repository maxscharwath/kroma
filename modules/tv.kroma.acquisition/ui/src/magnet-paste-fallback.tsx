// The magnet paste fallback: when a search finds nothing, the admin can still
// paste a magnet URI straight into the import pipeline. This is the same
// `POST /acquisition/add` the manual grab modal uses, trimmed to one field.

import { apiErrorText } from '@kroma/core';
import { useT } from '@kroma/module-sdk';
import { Box, Button, Callout, Field, Row } from '@kroma/ui/kit';
import { useState } from 'react';
import { useAcquisitionApi } from './api';

export function MagnetPasteFallback({
  kind,
  title,
  season,
  episode,
  onAdded,
}: Readonly<{
  kind: 'movie' | 'show';
  title: string;
  season: number | null;
  episode: number | null;
  onAdded?: () => void;
}>) {
  const t = useT();
  const acquisition = useAcquisitionApi();
  const [magnet, setMagnet] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);

  const trimmed = magnet.trim();
  const canAdd = trimmed.startsWith('magnet:') && trimmed.length > 'magnet:'.length;

  // The add body's `kind` is the torrent shape (movie/episode/season), not the
  // request's (movie/show). A show with an episode number is an episode; a show
  // with only a season is a season; everything else is a movie.
  function torrentKind(): 'movie' | 'episode' | 'season' {
    if (kind === 'movie') return 'movie';
    if (episode != null) return 'episode';
    return 'season';
  }
  const addKind = torrentKind();

  const add = () => {
    setBusy(true);
    setResult(null);
    acquisition
      .add({
        magnetOrUrl: trimmed,
        kind: addKind,
        title: title || null,
        year: null,
        season: kind === 'movie' ? null : season,
        episode: addKind === 'episode' ? episode : null,
        tmdbId: null,
        onlyFiles: null,
        detailsUrl: null,
      })
      .then(() => {
        setResult({
          text: `${t('requests.grabbed')} ${title || trimmed.slice(0, 40)}`,
          error: false,
        });
        setMagnet('');
        onAdded?.();
      })
      .catch((e) => setResult({ text: apiErrorText(e, t('requests.actionFailed')), error: true }))
      .finally(() => setBusy(false));
  };

  return (
    <Box gap={10}>
      <Row wrap gap={8} align="flex-end">
        <Box flex minW={200}>
          <Field.Root
            label={t('requests.magnetFallback')}
            hideLabel
            value={magnet}
            onValueChange={setMagnet}
          >
            <Field.Input icon="magnet" onSubmit={add} placeholder="magnet:?xt=urn:btih:..." />
          </Field.Root>
        </Box>
        <Button
          size="sm"
          icon="plus"
          label={t('requests.magnetAdd')}
          onPress={add}
          loading={busy}
          disabled={!canAdd}
        />
      </Row>
      {result ? (
        <Callout.Root tone={result.error ? 'danger' : 'success'}>
          <Callout.Title>{result.text}</Callout.Title>
        </Callout.Root>
      ) : null}
    </Box>
  );
}
