// The numbers above the queue: what is moving right now, and what has moved
// since the ledger began.
//
// Each rate carries its own trace INSIDE its card, because a number and its
// recent shape are one fact and splitting them across two panels made the page
// mostly empty. The samples come from the monitor rather than from this page,
// so a browser that was closed for ten minutes opens on the same picture as one
// that was not.

import { useFormat, useT } from '@kroma/module-sdk';
import type { IconName } from '@kroma/ui/kit';
import { Box, Chart, Grid, Icon, Row, Surface, Text } from '@kroma/ui/kit';
import { useMemo } from 'react';
import type { DownloadStatsView } from './schemas';

// Tall enough to read a trend, short enough that four of these still fit above
// the queue without pushing it off the screen.
const SPARK_HEIGHT = 44;

// A ratio only means anything once something has actually been downloaded.
function ratioOf(stats: DownloadStatsView): string | null {
  if (stats.totalDownloadedBytes <= 0) return null;
  return (stats.totalUploadedBytes / stats.totalDownloadedBytes).toFixed(2);
}

export function DownloadStats({ stats }: Readonly<{ stats: DownloadStatsView }>) {
  const t = useT();
  const fmt = useFormat();
  const perSecond = (bytes: number) => `${fmt.bytes(bytes)}/s`;

  const points = useMemo(
    () => stats.history.map((s) => ({ down: s.downBps, up: s.upBps })),
    [stats.history],
  );
  const ratio = ratioOf(stats);
  const queued = Object.entries(stats.byStatus)
    .filter(([status]) => status === 'queued' || status === 'paused')
    .reduce((sum, [, n]) => sum + n, 0);

  return (
    <Box mb={18}>
      <Grid min={230} gap={16}>
        <StatTile
          icon="download"
          label={t('downloads.statDown')}
          value={perSecond(stats.downBps)}
          tone="accent"
          foot={t('downloads.totalDown', { total: fmt.bytes(stats.totalDownloadedBytes) })}
          series="down"
          points={points}
          format={perSecond}
          chartLabel={t('downloads.chartDown', { rate: perSecond(stats.downBps) })}
        />
        <StatTile
          icon="upload"
          label={t('downloads.statUp')}
          value={perSecond(stats.upBps)}
          tone="success"
          foot={
            ratio
              ? t('downloads.totalUpRatio', {
                  total: fmt.bytes(stats.totalUploadedBytes),
                  ratio,
                })
              : t('downloads.totalUp', { total: fmt.bytes(stats.totalUploadedBytes) })
          }
          series="up"
          points={points}
          format={perSecond}
          chartLabel={t('downloads.chartUp', { rate: perSecond(stats.upBps) })}
        />
        <StatTile
          icon="player-play"
          label={t('downloads.statActive')}
          value={String(stats.active)}
          tone="text"
          foot={t('downloads.waiting', { count: String(queued) })}
        />
        <StatTile
          icon="users"
          label={t('downloads.statPeers')}
          value={String(stats.peers)}
          tone="text"
          foot={t('downloads.peersFoot')}
        />
      </Grid>
    </Box>
  );
}

interface StatTileProps {
  icon: IconName;
  label: string;
  value: string;
  tone: 'accent' | 'success' | 'text';
  /** The quiet line under the number: what the rate adds up to over time. */
  foot: string;
  /** The field on a sample this tile traces. Omit for a tile with no history. */
  series?: string;
  points?: readonly { down: number; up: number }[];
  format?: (value: number) => string;
  chartLabel?: string;
}

function StatTile({
  icon,
  label,
  value,
  tone,
  foot,
  series,
  points,
  format,
  chartLabel,
}: Readonly<StatTileProps>) {
  // Two samples are the fewest that can be a line; one is a dot nobody can read.
  const traced = series && points && points.length > 1;
  return (
    <Surface elevated radius="2xl" border="border" pad="none" overflow="hidden">
      <Box p={16} pb={traced ? 8 : 16} gap={6}>
        <Row gap={6} align="center">
          <Icon name={icon} size={13} thickness={2} color={tone === 'text' ? 'glyphDim' : tone} />
          <Text variant="overline" color="textDim">
            {label}
          </Text>
        </Row>
        <Text variant="heading" color={tone}>
          {value}
        </Text>
        <Text variant="meta" color="text/35" lines={1}>
          {foot}
        </Text>
      </Box>
      {traced ? (
        <Chart.Root data={points} height={SPARK_HEIGHT} min={0} format={format} label={chartLabel}>
          <Chart.Area series={series} color={tone === 'text' ? 'accent' : tone} />
        </Chart.Root>
      ) : null}
    </Surface>
  );
}
