import { useFormat, useT } from '@kroma/module-sdk';
import type { IconName } from '@kroma/ui/kit';
import { Box, Chart, Grid, Icon, Row, Surface, Text } from '@kroma/ui/kit';
import { useMemo } from 'react';
import type { DownloadStatsView } from './schemas';
import { useLiveStats } from './use-live-stats';

const CARD_HEIGHT = 152;
const SPARK_HEIGHT = 46;
// The window the trace covers. The ledger keeps three times this, which drawn
// whole turns a burst into a needle: the card is asking what is happening now,
// not what happened in the last half hour.
const SPARK_SAMPLES = 60;

function ratioOf(stats: DownloadStatsView): string | null {
  if (stats.totalDownloadedBytes <= 0) return null;
  return (stats.totalUploadedBytes / stats.totalDownloadedBytes).toFixed(2);
}

export function DownloadStats({ stats: polled }: Readonly<{ stats: DownloadStatsView }>) {
  const stats = useLiveStats(polled);
  const t = useT();
  const fmt = useFormat();
  const perSecond = (bytes: number) => `${fmt.bytes(bytes)}/s`;

  const points = useMemo(
    () =>
      stats.history
        .slice(-SPARK_SAMPLES)
        .map((s) => ({ down: s.downBps, up: s.upBps, active: s.active, peers: s.peers })),
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
          series="active"
          points={points}
          format={String}
          chartLabel={t('downloads.chartActive', { count: String(stats.active) })}
        />
        <StatTile
          icon="users"
          label={t('downloads.statPeers')}
          value={String(stats.peers)}
          tone="text"
          foot={t('downloads.peersFoot')}
          series="peers"
          points={points}
          format={String}
          chartLabel={t('downloads.chartPeers', { count: String(stats.peers) })}
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
  /** The field on a sample this tile traces. Omit for a tile with no history,
   *  which keeps the card's height and leaves the strip empty. */
  series?: 'down' | 'up' | 'active' | 'peers';
  points?: readonly { down: number; up: number; active: number; peers: number }[];
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
  const traced = series !== undefined && points !== undefined && points.length > 1;
  return (
    <Surface elevated radius="2xl" border="border" pad="none" overflow="hidden" h={CARD_HEIGHT}>
      <Box p={16} gap={6} flex>
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
          <Chart.Area series={series} color={tone === 'text' ? 'textDim' : tone} />
        </Chart.Root>
      ) : null}
    </Surface>
  );
}
