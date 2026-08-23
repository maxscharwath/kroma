// Free-text sweep results. No score column: nothing here was scored, because
// nothing here has a target to be scored against. What the row carries instead
// is what the parser read off the name, which is what the grab will import it as.
//
// Indexer filtering and sorting are local state: the server already sorted by
// seeders then size, but the admin may want to re-rank or narrow to one tracker
// after the fact -- especially when a single indexer dominates the results.

import { Table, useT } from '@kroma/module-sdk';
import { Box, EmptyState, Row, SegmentGroup, Text } from '@kroma/ui/kit';
import { useMemo, useState } from 'react';
import { QualityFilterBar } from './quality-filter-bar';
import { ReleaseFacts } from './release-cells';
import {
  EMPTY_QUALITY_FILTER,
  filterManualReleases,
  type ManualSort,
  type QualityFilter,
  sortManualReleases,
} from './release-sort';
import type { ManualReleaseView } from './schemas';

const COLUMNS = 'minmax(0,1fr) 150px 92px 84px 44px';

const MANUAL_SORTS: ManualSort[] = ['seeders', 'size', 'date'];

export function ManualReleaseTable({
  releases,
  canGrab,
  grabbing,
  onGrab,
  indexerFilter = null,
}: Readonly<{
  releases: ManualReleaseView[];
  canGrab: boolean;
  /** The guid of the row being grabbed, so only that row is busy. */
  grabbing: string | null;
  onGrab: (release: ManualReleaseView) => void;
  /** The indexer id to filter by, or null for all. Owned by the caller so the
   *  indexer strip and the table share one source of truth. */
  indexerFilter?: string | null;
}>) {
  const t = useT();
  const [sort, setSort] = useState<ManualSort>('seeders');
  const [quality, setQuality] = useState<QualityFilter>(EMPTY_QUALITY_FILTER);
  const rows = useMemo(
    () => sortManualReleases(filterManualReleases(releases, indexerFilter, quality), sort),
    [releases, sort, indexerFilter, quality],
  );

  if (releases.length === 0) {
    return (
      <Box py={20}>
        <EmptyState.Root icon="search">
          <EmptyState.Title>{t('requests.noReleases')}</EmptyState.Title>
        </EmptyState.Root>
      </Box>
    );
  }
  return (
    <Box gap={10}>
      <Row wrap between gap={10}>
        <Text variant="meta" color="textDim">
          {t('requests.resultsCount', { count: rows.length })}
        </Text>
        <SegmentGroup.Root value={sort} onValueChange={setSort} label={t('requests.sortBy')}>
          {MANUAL_SORTS.map((s) => (
            <SegmentGroup.Item key={s} value={s}>
              <SegmentGroup.Label>
                {t(MANUAL_SORT_LABEL[s] as Parameters<typeof t>[0])}
              </SegmentGroup.Label>
            </SegmentGroup.Item>
          ))}
        </SegmentGroup.Root>
      </Row>
      <QualityFilterBar filter={quality} onChange={setQuality} />
      {rows.length === 0 ? (
        <Box py={20}>
          <EmptyState.Root icon="search">
            <EmptyState.Title>{t('requests.noReleasesForIndexer')}</EmptyState.Title>
          </EmptyState.Root>
        </Box>
      ) : (
        <Table.Root columns={COLUMNS}>
          <Table.Header>
            <Table.Column>{t('requests.colRelease')}</Table.Column>
            <Table.Column wide>{t('requests.colIndexer')}</Table.Column>
            <Table.Column wide>{t('requests.colSize')}</Table.Column>
            <Table.Column wide>{t('requests.colSeeders')}</Table.Column>
            <Table.Cell />
          </Table.Header>
          {rows.map((r) => (
            <ManualRow
              key={`${r.indexerId}-${r.guid}`}
              r={r}
              canGrab={canGrab}
              busy={grabbing != null}
              onGrab={onGrab}
            />
          ))}
        </Table.Root>
      )}
    </Box>
  );
}

const MANUAL_SORT_LABEL: Record<ManualSort, string> = {
  seeders: 'requests.colSeeders',
  size: 'requests.colSize',
  date: 'requests.colPublished',
};

function ManualRow({
  r,
  canGrab,
  busy,
  onGrab,
}: Readonly<{
  r: ManualReleaseView;
  canGrab: boolean;
  busy: boolean;
  onGrab: (release: ManualReleaseView) => void;
}>) {
  const t = useT();
  const grabbable = Boolean(r.downloadUrl || r.detailsUrl);
  const target = parsedTarget(r);
  return (
    <Table.Row>
      <Table.Cell>
        <Text variant="meta" lines={1}>
          {r.title}
        </Text>
        <Row wrap gapX={10} mt={2}>
          {target ? (
            <Text variant="meta" color="info">
              {target}
            </Text>
          ) : null}
          {r.resolution ? (
            <Text variant="meta" color="textDim">
              {r.resolution}
            </Text>
          ) : null}
          {r.codec ? (
            <Text variant="meta" color="hdr">
              {r.codec}
            </Text>
          ) : null}
        </Row>
      </Table.Cell>
      <ReleaseFacts
        indexerName={r.indexerName}
        detailsUrl={r.detailsUrl}
        sizeBytes={r.sizeBytes}
        seeders={r.seeders}
      />
      <Table.Cell>
        {canGrab && grabbable ? (
          <Table.Action
            tone="accent"
            icon="download"
            label={t('requests.grab')}
            disabled={busy}
            onPress={() => onGrab(r)}
          />
        ) : null}
      </Table.Cell>
    </Table.Row>
  );
}

/** `S03E07` / `S03` / null for anything the parser read as a film. */
function parsedTarget(r: ManualReleaseView): string | null {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (r.season == null) return null;
  if (r.fullSeason || r.episode == null) return `S${pad(r.season)}`;
  return `S${pad(r.season)}E${pad(r.episode)}`;
}
