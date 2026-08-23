// What every indexer made of the last sweep. An error banner alone could not
// say whether the other trackers were asked, answered, or were never reached:
// one row per indexer, so "nothing found" and "the tracker is down" stop looking
// like the same result.
//
// Each pill is also a filter toggle: click to show only that indexer's releases,
// click again to clear. The active state is owned by the caller so it survives
// re-renders from the search hook.

import { useT } from '@kroma/module-sdk';
import { Box, Chip, Row, Text } from '@kroma/ui/kit';

/** What the strip needs of an indexer's answer. Structural rather than the
 *  branded `IndexerReport`, because the free-text sweep is a module's own wire
 *  type carrying the same five fields. */
export interface IndexerAnswer {
  id: string;
  name: string;
  found: number;
  error: string | null;
  elapsedMs: number;
}

export function IndexerReportStrip({
  indexers = [],
  activeIndexer = null,
  onToggleIndexer,
}: Readonly<{
  indexers?: IndexerAnswer[];
  /** The indexer id currently filtering results, or null for "all". */
  activeIndexer?: string | null;
  /** Called with the indexer id to toggle, or null to clear. */
  onToggleIndexer?: (id: string | null) => void;
}>) {
  const t = useT();
  if (indexers.length === 0) return null;
  const failed = indexers.filter((i) => i.error).length;
  const interactive = onToggleIndexer != null;
  return (
    <Box gap={8}>
      <Row wrap gap={8}>
        {indexers.map((i) => (
          <IndexerPill
            key={i.id}
            report={i}
            active={interactive && activeIndexer === i.id}
            onPress={interactive ? () => onToggleIndexer(i.id) : undefined}
          />
        ))}
      </Row>
      {failed > 0 ? (
        <Text variant="meta" color="textDim">
          {t('requests.indexersFailed', { count: failed, total: indexers.length })}
        </Text>
      ) : null}
    </Box>
  );
}

function IndexerPill({
  report,
  active,
  onPress,
}: Readonly<{
  report: IndexerAnswer;
  active: boolean;
  onPress?: () => void;
}>) {
  const t = useT();
  const tone = pillTone(report);
  const label = report.error
    ? `${report.name} · ${t('requests.indexerDown')}`
    : `${report.name} · ${report.found} · ${formatElapsed(report.elapsedMs)}`;
  return (
    <Chip
      label={label}
      dot={tone}
      active={active}
      variant={active ? 'solid' : 'subtle'}
      onPress={onPress}
    />
  );
}

function pillTone(report: IndexerAnswer): 'danger' | 'success' | 'textDim' {
  if (report.error) return 'danger';
  return report.found > 0 ? 'success' : 'textDim';
}

function formatElapsed(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
