// Choosing which title a torrent is for.
//
// Shared by the manual-add flow and the "fix the match" menu action, because
// they ask the same question at different moments. The candidates and their
// confidence come from the same ranking the automatic pass uses, so an operator
// can see WHY it went wrong rather than only that it did.

import { useT } from '@kroma/module-sdk';
import { Badge, Box, Button, EmptyState, Field, Img, Row, Spinner, Text } from '@kroma/ui/kit';
import { useCallback, useEffect, useState } from 'react';
import { useTorrentsApi } from './api';
import type { MatchCandidateView } from './schemas';

const POSTER_WIDTH = 46;
const POSTER_HEIGHT = 69;

// Above this the ranking is as sure as the automatic pass would need to be. The
// tone is what says so: the number alone means nothing to someone who has not
// read the scorer.
const CONFIDENT = 0.55;
const PLAUSIBLE = 0.35;

function toneFor(score: number): 'success' | 'info' | 'neutral' {
  if (score >= CONFIDENT) return 'success';
  if (score >= PLAUSIBLE) return 'info';
  return 'neutral';
}

interface TitlePickerProps {
  /** What to search for before the operator types anything: the release name's
   *  own reading. */
  initialQuery: string;
  /** `movie` narrows to films, anything else to shows. */
  kind: string;
  year?: number | null;
  /** The title already pinned, marked in the list. */
  currentTmdbId?: number | null;
  onPick: (candidate: MatchCandidateView) => void;
  /** Disables the pick buttons while the caller is writing. */
  busy?: boolean;
}

/** A search box over the metadata provider and its ranked results. */
export function TitlePicker({
  initialQuery,
  kind,
  year,
  currentTmdbId,
  onPick,
  busy = false,
}: Readonly<TitlePickerProps>) {
  const t = useT();
  const torrents = useTorrentsApi();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MatchCandidateView[] | null>(null);
  const [searching, setSearching] = useState(false);

  const search = useCallback(
    (text: string) => {
      const words = text.trim();
      if (!words) return;
      setSearching(true);
      torrents
        .searchTitles(words, kind, year ?? undefined)
        .then((view) => setResults(view.results))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    },
    [torrents, kind, year],
  );

  // The release name's own reading is the opening search; an operator retypes it
  // only when that is what missed.
  useEffect(() => search(initialQuery), [search, initialQuery]);

  return (
    <Box gap={10}>
      <Row gap={8}>
        <Field.Root
          label={t('downloads.linkSearchLabel')}
          hideLabel
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

      <Box gap={6} maxH={320} overflow="scroll">
        {searching ? (
          <Row center py={24}>
            <Spinner />
          </Row>
        ) : null}
        {!searching && results?.length === 0 ? (
          <Box py={20}>
            <EmptyState.Root icon="search-off">
              <EmptyState.Title>{t('downloads.linkNoResults')}</EmptyState.Title>
            </EmptyState.Root>
          </Box>
        ) : null}
        {!searching
          ? results?.map((candidate) => (
              <CandidateRow
                key={candidate.tmdbId}
                candidate={candidate}
                current={candidate.tmdbId === currentTmdbId}
                busy={busy}
                onPick={() => onPick(candidate)}
              />
            ))
          : null}
      </Box>
    </Box>
  );
}

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
          <Text variant="label" lines={1} shrink={1} minW={0}>
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
