// Step two of a manual add: which title this torrent is for.
//
// The old form asked an operator to TYPE a title, a year, a season and an
// episode, and then sent no tmdb id at all, so a manual grab landed in the
// queue unlinked and imported under whatever the filename said.
//
// Now the torrent's own files answer three of those four: the analysis says
// whether it is a film, an episode or a season pack, and which seasons and how
// many episodes are in it. All that is left to ask is the one thing the files
// cannot know, which is the title, and that is a picker rather than a text box.

import type { TorrentAnalysis } from '@kroma/module-acquisition/schemas';
import { useT } from '@kroma/module-sdk';
import {
  Badge,
  Box,
  Button,
  Callout,
  Field,
  Icon,
  Row,
  Spinner,
  Surface,
  Text,
} from '@kroma/ui/kit';
import { type DetectedContent, detect, summaryOf } from './manual-grab-content';
import type { MatchCandidateView } from './schemas';
import { TitlePicker } from './title-picker';

export type Kind = 'movie' | 'episode' | 'season';

const KIND_LABEL = {
  movie: 'manual.kindMovie',
  season: 'manual.kindSeason',
  episode: 'manual.kindEpisode',
} as const;

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
  /** What the torrent holds. Null while it is still being read. */
  analysis: TorrentAnalysis | null;
  analyzing: boolean;
  analyzeError: string | null;
  onRetryAnalyze: () => void;
}

export function TargetStep({
  releaseTitle,
  target,
  onTargetChange,
  analysis,
  analyzing,
  analyzeError,
  onRetryAnalyze,
}: Readonly<TargetStepProps>) {
  const t = useT();
  const set = (patch: Partial<GrabTarget>) => onTargetChange({ ...target, ...patch });
  const found = analysis ? detect(analysis) : null;

  const pick = (candidate: MatchCandidateView) =>
    set({
      tmdbId: candidate.tmdbId,
      title: candidate.title,
      year: candidate.year ? String(candidate.year) : '',
    });

  return (
    <Box gap={14}>
      <ContentLine
        found={found}
        analyzing={analyzing}
        error={analyzeError}
        onRetry={onRetryAnalyze}
      />

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

      {/* Only when the files did not settle it: a magnet whose metadata never
          resolved, or a torrent with no video the classifier recognised. */}
      {found?.certain ? null : <ManualShape target={target} onChange={set} />}
    </Box>
  );
}

// What the torrent holds, said once, as a fact rather than a form.
function ContentLine({
  found,
  analyzing,
  error,
  onRetry,
}: Readonly<{
  found: DetectedContent | null;
  analyzing: boolean;
  error: string | null;
  onRetry: () => void;
}>) {
  const t = useT();
  if (analyzing) {
    return (
      <Row gap={8} align="center">
        <Spinner size={14} />
        <Text variant="meta" color="text/50">
          {t('manual.analyzing')}
        </Text>
      </Row>
    );
  }
  if (error) {
    return (
      <Callout.Root size="sm" tone="accent" icon="alert-triangle">
        <Callout.Title>{t('manual.contentUnknown')}</Callout.Title>
        <Callout.Actions>
          <Button variant="glass" size="sm" label={t('manual.analyze')} onPress={onRetry} />
        </Callout.Actions>
      </Callout.Root>
    );
  }
  if (!found?.certain) return null;
  const summary = summaryOf(found);
  return (
    <Row gap={8} align="center">
      <Icon name="circle-check" size={14} thickness={2} color="success" />
      <Text variant="meta" color="text/60">
        {t(`manual.found.${summary.key}`, summary.vars)}
      </Text>
    </Row>
  );
}

// The fallback the files could not answer. Reached only when the analysis came
// back empty, so it is never in the way of the flow that worked.
function ManualShape({
  target,
  onChange,
}: Readonly<{ target: GrabTarget; onChange: (patch: Partial<GrabTarget>) => void }>) {
  const t = useT();
  return (
    <Box gap={10}>
      <Row gap={8} wrap align="center">
        <Text variant="meta" color="text/40">
          {t('manual.shapeLabel')}
        </Text>
        {(['movie', 'season', 'episode'] as const).map((kind) => (
          <Button
            key={kind}
            variant="outline"
            size="sm"
            label={t(KIND_LABEL[kind])}
            active={target.kind === kind}
            onPress={() => onChange({ kind })}
          />
        ))}
      </Row>
      {target.kind !== 'movie' ? (
        <Row gap={12}>
          <Field.Root
            label={t('manual.season')}
            value={target.season}
            onValueChange={(season) => onChange({ season })}
            flex
            size="sm"
          >
            <Field.Input placeholder="1" />
          </Field.Root>
          {target.kind === 'episode' ? (
            <Field.Root
              label={t('manual.episode')}
              value={target.episode}
              onValueChange={(episode) => onChange({ episode })}
              flex
              size="sm"
            >
              <Field.Input placeholder="1" />
            </Field.Root>
          ) : null}
        </Row>
      ) : null}
    </Box>
  );
}
