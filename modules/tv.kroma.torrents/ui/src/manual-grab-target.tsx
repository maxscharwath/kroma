// Step two of a manual add: which title this torrent is for.
//
// The old form asked an operator to TYPE a title and a year, and then sent no
// tmdb id at all, so a manual grab landed in the queue unlinked and imported
// under whatever the filename said. This picks a real title instead, which is
// the same picker the "fix the match" action uses.

import { useT } from '@kroma/module-sdk';
import { Badge, Box, Button, Field, Row, SegmentGroup, Surface, Text } from '@kroma/ui/kit';
import type { MatchCandidateView } from './schemas';
import { TitlePicker } from './title-picker';

export type Kind = 'movie' | 'episode' | 'season';

/** The title a grab is for, once an operator has settled it. */
export interface GrabTarget {
  kind: Kind;
  tmdbId: number | null;
  title: string;
  year: string;
  season: string;
  episode: string;
}

interface TargetStepProps {
  /** The release name, which seeds the search and is what the row falls back to. */
  releaseTitle: string;
  target: GrabTarget;
  onTargetChange: (next: GrabTarget) => void;
}

export function TargetStep({ releaseTitle, target, onTargetChange }: Readonly<TargetStepProps>) {
  const t = useT();
  const set = (patch: Partial<GrabTarget>) => onTargetChange({ ...target, ...patch });

  const pick = (candidate: MatchCandidateView) =>
    set({
      tmdbId: candidate.tmdbId,
      title: candidate.title,
      year: candidate.year ? String(candidate.year) : '',
    });

  return (
    <Box gap={14}>
      <SegmentGroup.Root
        value={target.kind}
        onValueChange={(kind: Kind) => set({ kind })}
        label={t('manual.kind')}
        stretch
      >
        <SegmentGroup.Item value="movie" icon="movie">
          <SegmentGroup.Label>{t('manual.kindMovie')}</SegmentGroup.Label>
        </SegmentGroup.Item>
        <SegmentGroup.Item value="season" icon="stack">
          <SegmentGroup.Label>{t('manual.kindSeason')}</SegmentGroup.Label>
        </SegmentGroup.Item>
        <SegmentGroup.Item value="episode" icon="device-tv">
          <SegmentGroup.Label>{t('manual.kindEpisode')}</SegmentGroup.Label>
        </SegmentGroup.Item>
      </SegmentGroup.Root>

      {target.tmdbId ? (
        <Surface radius="xl" border="border" p={12}>
          <Row between gap={12} align="center">
            <Row gap={8} minW={0}>
              <Badge tone="success">{t('manual.linked')}</Badge>
              <Text variant="label" lines={1} shrink={1} minW={0}>
                {target.year ? `${target.title} (${target.year})` : target.title}
              </Text>
            </Row>
            <Button
              variant="ghost"
              size="sm"
              icon="x"
              label={t('manual.unlink')}
              onPress={() => set({ tmdbId: null })}
            />
          </Row>
        </Surface>
      ) : (
        <TitlePicker
          initialQuery={target.title || releaseTitle}
          kind={target.kind}
          year={target.year ? Number.parseInt(target.year, 10) : null}
          onPick={pick}
        />
      )}

      {target.kind !== 'movie' ? (
        <Row gap={12}>
          <Field.Root
            label={t('manual.season')}
            value={target.season}
            onValueChange={(season) => set({ season })}
            flex
          >
            <Field.Input placeholder="1" />
          </Field.Root>
          {target.kind === 'episode' ? (
            <Field.Root
              label={t('manual.episode')}
              value={target.episode}
              onValueChange={(episode) => set({ episode })}
              flex
            >
              <Field.Input placeholder="1" />
            </Field.Root>
          ) : null}
        </Row>
      ) : null}
    </Box>
  );
}
