// "This download is for the wrong title": the picker that fixes it.
//
// The automatic pass reads the release name, and a release name is a guess. The
// candidates and their confidence come from the same ranking the automatic pass
// used, so an operator can see WHY it went wrong rather than only that it did.
// It works at any stage: nothing about the torrent changes when the title does.

import { useAsyncAction, useT } from '@kroma/module-sdk';
import {
  Badge,
  Box,
  Button,
  Callout,
  Dialog,
  EmptyState,
  Field,
  Img,
  NumberField,
  Row,
  Spinner,
  Text,
} from '@kroma/ui/kit';
import { useCallback, useEffect, useState } from 'react';
import { createCallable } from 'react-call';
import { useTorrentsApi } from './api';
import type { DownloadView, MatchCandidatesView, MatchCandidateView } from './schemas';

const NUMBER_WIDTH = 132;
const POSTER_WIDTH = 46;
const POSTER_HEIGHT = 69;

// Above this the ranking is as sure as the automatic pass would need to be; the
// tone is the only thing that says so, because the number alone means nothing
// to someone who has not read the scorer.
const CONFIDENT = 0.55;

function toneFor(score: number): 'success' | 'info' | 'neutral' {
  if (score >= CONFIDENT) return 'success';
  if (score >= 0.35) return 'info';
  return 'neutral';
}

interface LinkModalProps {
  dl: DownloadView;
}

/** Opened with `LinkModal.call({ dl })`; resolves `true` once a title is
 *  pinned, so the caller can refetch. */
export const LinkModal = createCallable<LinkModalProps, boolean>(({ call, dl }) => {
  const t = useT();
  const torrents = useTorrentsApi();
  const { busy, error, run } = useAsyncAction();

  const [found, setFound] = useState<MatchCandidatesView | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(true);
  // Only a season or an episode carries these, and the release name's guess is
  // the starting point rather than the answer.
  const [season, setSeason] = useState(dl.season ?? 1);
  const [episode, setEpisode] = useState(dl.episodes?.[0] ?? 1);

  const search = useCallback(
    (text?: string) => {
      setSearching(true);
      torrents
        .candidates(dl.id, text)
        .then((view) => {
          setFound(view);
          // Only the opening search adopts what the release name parsed to; a
          // retyped one must not have the box change under the operator.
          if (text === undefined) setQuery(view.query);
        })
        .catch(() => setFound(null))
        .finally(() => setSearching(false));
    },
    [torrents, dl.id],
  );

  useEffect(() => search(), [search]);

  const pick = (candidate: MatchCandidateView) =>
    run(
      async () => {
        const isMovie = dl.kind === 'movie';
        await torrents.link(dl.id, {
          kind: dl.kind,
          tmdbId: candidate.tmdbId,
          title: candidate.title,
          year: candidate.year,
          season: isMovie ? null : season,
          episodes: dl.kind === 'episode' ? [episode] : null,
        });
        call.end(true);
      },
      () => t('downloads.linkFailed'),
    );

  return (
    <Dialog.Root open title={t('downloads.linkTitle')} onClose={() => call.end(false)} width="md">
      <Text variant="meta" color="text/60">
        {dl.releaseTitle}
      </Text>

      <Row gap={8} align="flex-end">
        <Field.Root
          label={t('downloads.linkSearchLabel')}
          flex
          value={query}
          onValueChange={setQuery}
        >
          <Field.Input
            icon="search"
            placeholder={t('downloads.linkSearchPlaceholder')}
            onSubmit={() => search(query)}
          />
        </Field.Root>
        <Button
          variant="glass"
          icon="search"
          label={t('downloads.linkSearch')}
          onPress={() => search(query)}
          disabled={searching}
        />
      </Row>

      {dl.kind !== 'movie' ? (
        <Box gap={6}>
          <Row gap={10}>
            <Field.Root label={t('downloads.season')} w={NUMBER_WIDTH}>
              <NumberField
                value={season}
                onValueChange={setSeason}
                label={t('downloads.season')}
                min={0}
              />
            </Field.Root>
            {dl.kind === 'episode' ? (
              <Field.Root label={t('downloads.episode')} w={NUMBER_WIDTH}>
                <NumberField
                  value={episode}
                  onValueChange={setEpisode}
                  label={t('downloads.episode')}
                  min={0}
                />
              </Field.Root>
            ) : null}
          </Row>
          <Text variant="meta" color="text/35">
            {t('downloads.linkNumbersHint')}
          </Text>
        </Box>
      ) : null}

      {error ? (
        <Callout.Root size="sm" tone="danger" icon="alert-triangle">
          <Callout.Title>{error}</Callout.Title>
        </Callout.Root>
      ) : null}

      <Box mt={4} gap={6} maxH={340} overflow="scroll">
        {searching ? (
          <Row center py={24}>
            <Spinner />
          </Row>
        ) : null}
        {!searching && (found?.results.length ?? 0) === 0 ? (
          <Box py={20}>
            <EmptyState.Root icon="search-off">
              <EmptyState.Title>{t('downloads.linkNoResults')}</EmptyState.Title>
            </EmptyState.Root>
          </Box>
        ) : null}
        {found?.results.map((candidate) => (
          <CandidateRow
            key={candidate.tmdbId}
            candidate={candidate}
            current={candidate.tmdbId === found.currentTmdbId}
            busy={busy}
            onPick={() => pick(candidate)}
          />
        ))}
      </Box>

      <Dialog.Footer>
        <Dialog.Actions onCancel={() => call.end(false)} cancelLabel={t('common.cancel')} />
      </Dialog.Footer>
    </Dialog.Root>
  );
});

function CandidateRow({
  candidate,
  current,
  busy,
  onPick,
}: Readonly<{
  candidate: MatchCandidateView;
  current: boolean;
  busy: boolean;
  onPick: () => void;
}>) {
  const t = useT();
  return (
    <Row gap={12} p={8} radius="lg" bg={current ? 'tint/8' : 'transparent'}>
      <Box
        w={POSTER_WIDTH}
        h={POSTER_HEIGHT}
        shrink={0}
        center
        radius={4}
        overflow="hidden"
        bg="tint/5"
      >
        {candidate.posterUrl ? <Img src={candidate.posterUrl} fill /> : null}
      </Box>
      <Box flex minW={0} gap={2}>
        <Row gap={8} minW={0}>
          <Text variant="label" lines={1} flex minW={0}>
            {candidate.year ? `${candidate.title} (${candidate.year})` : candidate.title}
          </Text>
          <Badge tone={toneFor(candidate.score)}>{`${Math.round(candidate.score * 100)}%`}</Badge>
          {current ? <Badge tone="info">{t('downloads.linkCurrent')}</Badge> : null}
        </Row>
        {candidate.overview ? (
          <Text variant="meta" color="text/40" lines={2}>
            {candidate.overview}
          </Text>
        ) : null}
      </Box>
      <Button
        variant="glass"
        size="sm"
        label={t('downloads.linkPick')}
        onPress={onPick}
        disabled={busy}
      />
    </Row>
  );
}
