// Manual grab: three questions, one at a time.
//
//   1. Where is the torrent?   search the indexers, paste a magnet, drop a file
//   2. What is it FOR?         a real title, picked from the metadata provider
//   3. Which files?            the torrent's own list, when there is a choice
//
// The old version asked all three at once on a single tall form, and never
// actually linked the grab to a title: it sent no tmdb id, so a manual add
// landed in the queue unlinked. Steps make the order obvious and let step 2 be
// a picker rather than two text boxes.
//
// NOTE an inversion: the backend graph has acquisition dependencies torrents, yet
// this file (torrents) drives acquisition's search/analyze/add. The entangle-
// ment is real (a manual grab needs both halves) and predates this layout. If it
// ever needs untangling, the manual-grab flow moves INTO acquisition and reaches
// this page via module exports (`getModuleApi`), not by a package import in this
// direction.

import { useAcquisitionApi } from '@kroma/module-acquisition/api';
import type { TorrentAnalysis } from '@kroma/module-acquisition/schemas';
import { apiErrorText, useAsyncAction, useT } from '@kroma/module-sdk';
import { Box, Button, Callout, Dialog, Row, Text } from '@kroma/ui/kit';
import { useState } from 'react';
import { detect } from './manual-grab-content';
import { useIndexerSearch } from './manual-grab-search';
import { SourceStep, type TorrentSource } from './manual-grab-source';
import { type GrabTarget, type Kind, TargetStep } from './manual-grab-target';
import { TorrentContents } from './torrent-contents';
import { useEpisodeNames } from './use-episode-names';

const STEPS = ['source', 'target', 'files'] as const;
type Step = (typeof STEPS)[number];

const EMPTY_TARGET: GrabTarget = {
  kind: 'movie',
  tmdbId: null,
  title: '',
  year: '',
  season: '',
  episode: '',
};

// What the source already read off the release name, so step 2 opens on a title
// the provider can actually find rather than on the raw scene string.
function targetFrom(source: TorrentSource): GrabTarget {
  return {
    kind: (source.kind as Kind) || 'movie',
    tmdbId: null,
    title: source.title,
    year: source.year ? String(source.year) : '',
    season: source.season ? String(source.season) : '',
    episode: source.episodes?.[0] ? String(source.episodes[0]) : '',
  };
}

export function ManualGrabModal({
  onClose,
  onAdded,
}: Readonly<{ onClose: () => void; onAdded: () => void }>) {
  const t = useT();
  const acquisition = useAcquisitionApi();
  const { busy, error, run } = useAsyncAction();

  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<TorrentSource | null>(null);
  const [target, setTarget] = useState<GrabTarget>(EMPTY_TARGET);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TorrentAnalysis | null>(null);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const search = useIndexerSearch(target.kind, target.season, target.episode);
  const episodeNames = useEpisodeNames(
    target.tmdbId,
    target.season ? Number.parseInt(target.season, 10) : null,
  );

  const takeSource = (picked: TorrentSource) => {
    setSource(picked);
    setTarget((current) => {
      const seeded = targetFrom(picked);
      // A title the operator already pinned survives going back a step.
      return current.tmdbId ? { ...seeded, ...current } : seeded;
    });
    setStep('target');
    // Straight away, because what the torrent HOLDS is what decides the rest:
    // the kind scopes the title search, and the seasons and episodes are read
    // off the files instead of being typed.
    analyze(picked.magnet);
  };

  const analyze = (magnet: string) => {
    if (!magnet) return;
    setAnalyzing(true);
    setAnalyzeErr(null);
    setAnalysis(null);
    acquisition
      .analyze(magnet)
      .then((found) => {
        setAnalysis(found);
        // Default selection is every video file: narrowing it is the point of
        // the files step, but taking everything is the right starting answer.
        setSelected(new Set(found.files.filter((f) => f.isVideo).map((f) => f.index)));
        // The files outrank the release name, which was only ever a guess.
        const content = detect(found);
        if (content.certain) {
          setTarget((current) => ({
            ...current,
            kind: content.kind,
            season: content.season,
            episode: content.episode,
          }));
        }
      })
      .catch((e) => setAnalyzeErr(apiErrorText(e, t('manual.analyzeFailed'))))
      .finally(() => setAnalyzing(false));
  };

  const videoFiles = analysis?.files.filter((f) => f.isVideo) ?? [];

  const add = () =>
    run(
      async () => {
        if (!source) return;
        // Only sent when the operator narrowed the selection; everything else
        // means "take the torrent as it is".
        const onlyFiles =
          analysis && selected.size > 0 && selected.size < videoFiles.length
            ? [...selected].sort((a, b) => a - b)
            : null;
        await acquisition.add({
          magnetOrUrl: source.magnet,
          kind: target.kind,
          title: target.title.trim() || null,
          year: target.year ? Number.parseInt(target.year, 10) : null,
          season:
            target.kind !== 'movie' && target.season ? Number.parseInt(target.season, 10) : null,
          episode:
            target.kind === 'episode' && target.episode
              ? Number.parseInt(target.episode, 10)
              : null,
          tmdbId: target.tmdbId,
          onlyFiles,
          detailsUrl: source.detailsUrl,
        });
        onAdded();
        onClose();
      },
      (e) => apiErrorText(e, t('manual.addFailed')),
    );

  return (
    <Dialog.Root open title={t('manual.title')} onClose={onClose} width="lg">
      <StepBar step={step} onStep={setStep} reached={source !== null} />

      {step === 'source' ? <SourceStep search={search} onPicked={takeSource} /> : null}

      {step === 'target' && source ? (
        <TargetStep
          releaseTitle={source.releaseTitle}
          target={target}
          onTargetChange={setTarget}
          analysis={analysis}
          analyzing={analyzing}
          analyzeError={analyzeErr}
          onRetryAnalyze={() => analyze(source.magnet)}
        />
      ) : null}

      {step === 'files' && source ? (
        <Box gap={12}>
          {analyzeErr ? (
            <Callout.Root size="sm" tone="danger" icon="alert-triangle">
              <Callout.Title>{analyzeErr}</Callout.Title>
              <Callout.Actions>
                <Button
                  variant="glass"
                  size="sm"
                  label={t('manual.analyze')}
                  onPress={() => analyze(source.magnet)}
                  loading={analyzing}
                />
              </Callout.Actions>
            </Callout.Root>
          ) : null}
          {analyzing ? (
            <Text variant="meta" color="text/45">
              {t('manual.analyzing')}
            </Text>
          ) : null}
          {analysis ? (
            <TorrentContents
              analysis={analysis}
              episodes={episodeNames}
              selection={{
                selected,
                onSet: setSelected,
                onToggle: (index) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  }),
              }}
            />
          ) : null}
        </Box>
      ) : null}

      {error ? (
        <Callout.Root size="sm" tone="danger" icon="alert-triangle">
          <Callout.Title>{error}</Callout.Title>
        </Callout.Root>
      ) : null}

      <Footer
        step={step}
        canContinue={source !== null}
        busy={busy}
        onBack={() => setStep(step === 'files' ? 'target' : 'source')}
        onNext={() => setStep('files')}
        onCancel={onClose}
        onAdd={add}
      />
    </Dialog.Root>
  );
}

// Where the flow is, and a way back to a step already answered. Forward is
// earned by answering, so a step ahead is not a link.
function StepBar({
  step,
  onStep,
  reached,
}: Readonly<{ step: Step; onStep: (next: Step) => void; reached: boolean }>) {
  const t = useT();
  const at = STEPS.indexOf(step);
  return (
    <Row gap={8} align="center" mb={4}>
      {STEPS.map((name, index) => {
        const done = index < at;
        const behind = index <= at && reached;
        return (
          <Row key={name} gap={8} align="center" shrink={1} minW={0}>
            <Button
              variant={index === at ? 'glass' : 'ghost'}
              size="sm"
              icon={done ? 'circle-check' : undefined}
              label={`${index + 1}. ${t(`manual.step.${name}`)}`}
              disabled={!behind || index === at}
              onPress={() => onStep(name)}
            />
            {index < STEPS.length - 1 ? (
              <Text variant="meta" color="text/20">
                ›
              </Text>
            ) : null}
          </Row>
        );
      })}
    </Row>
  );
}

function Footer({
  step,
  canContinue,
  busy,
  onBack,
  onNext,
  onCancel,
  onAdd,
}: Readonly<{
  step: Step;
  canContinue: boolean;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  onAdd: () => void;
}>) {
  const t = useT();
  if (step === 'source') {
    return (
      <Row justify="flex-end" gap={8} mt={4}>
        <Button variant="ghost" label={t('common.cancel')} onPress={onCancel} />
      </Row>
    );
  }
  return (
    <Row between gap={8} mt={4}>
      <Button variant="ghost" icon="arrow-left" label={t('manual.back')} onPress={onBack} />
      <Row gap={8}>
        <Button variant="ghost" label={t('common.cancel')} onPress={onCancel} />
        {step === 'target' ? (
          <Button
            variant="primary"
            icon="arrow-right"
            label={t('manual.next')}
            onPress={onNext}
            disabled={!canContinue}
          />
        ) : (
          <Button
            variant="primary"
            icon="download"
            label={busy ? t('manual.adding') : t('manual.add')}
            onPress={onAdd}
            loading={busy}
            disabled={!canContinue}
          />
        )}
      </Row>
    </Row>
  );
}
