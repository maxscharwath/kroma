import { useFormat, useT } from '@kroma/module-sdk';
import type { IconName } from '@kroma/ui/kit';
import { Box, Chart, Grid, Icon, Row, Surface, Text } from '@kroma/ui/kit';
import { useMemo } from 'react';
import type { DownloadStatsView } from './schemas';
import { useLiveStats } from './use-live-stats';

const CHART_HEIGHT = 148;
// The window the plot covers. The ledger keeps three times this, and drawing it
// whole turns a burst into a needle against a floor of zeroes.
const SAMPLES = 60;

function ratioOf(stats: DownloadStatsView): string | null {
  if (stats.totalDownloadedBytes <= 0) return null;
  return (stats.totalUploadedBytes / stats.totalDownloadedBytes).toFixed(2);
}

export function DownloadStats({ stats: polled }: Readonly<{ stats: DownloadStatsView }>) {
  const stats = useLiveStats(polled);
  const t = useT();
  const fmt = useFormat();
  const perSecond = (bytes: number) => `${fmt.bytes(bytes)}/s`;

  const ratio = ratioOf(stats);
  const queued = Object.entries(stats.byStatus)
    .filter(([status]) => status === 'queued' || status === 'paused')
    .reduce((sum, [, n]) => sum + n, 0);

  return (
    <Box mb={18} gap={12}>
      <Grid min={200} gap={12}>
        <StatTile
          icon="download"
          label={t('downloads.statDown')}
          value={perSecond(stats.downBps)}
          tone="accent"
          foot={t('downloads.totalDown', { total: fmt.bytes(stats.totalDownloadedBytes) })}
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
      <ThroughputChart stats={stats} />
    </Box>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
  foot,
}: Readonly<{
  icon: IconName;
  label: string;
  value: string;
  tone: 'accent' | 'success' | 'text';
  foot: string;
}>) {
  return (
    <Surface elevated radius="xl" border="border" pad="none">
      <Box px={14} py={12} gap={2}>
        <Row gap={6} align="center">
          <Icon name={icon} size={12} thickness={2} color={tone === 'text' ? 'glyphDim' : tone} />
          <Text variant="overline" color="textDim">
            {label}
          </Text>
        </Row>
        <Text variant="title" color={tone}>
          {value}
        </Text>
        <Text variant="meta" color="text/35" lines={1}>
          {foot}
        </Text>
      </Box>
    </Surface>
  );
}

function ThroughputChart({ stats }: Readonly<{ stats: DownloadStatsView }>) {
  const t = useT();
  const fmt = useFormat();
  const perSecond = (bytes: number) => `${fmt.bytes(bytes)}/s`;

  const points = useMemo(
    () =>
      stats.history.slice(-SAMPLES).map((s) => ({
        at: new Date(s.atMs).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }),
        down: s.downBps,
        up: s.upBps,
      })),
    [stats.history],
  );
  if (points.length < 2) return null;

  return (
    <Surface elevated radius="xl" border="border" pad="none">
      <Box px={14} pt={12} pb={4}>
        <Chart.Root
          data={points}
          x="at"
          height={CHART_HEIGHT}
          min={0}
          format={perSecond}
          label={t('downloads.chartThroughput', {
            down: perSecond(stats.downBps),
            up: perSecond(stats.upBps),
          })}
        >
          <Chart.Grid />
          <Chart.Area series="down" label={t('downloads.statDown')} color="accent" />
          <Chart.Line series="up" label={t('downloads.statUp')} color="success" />
          <Chart.Axis edge="left" />
          <Chart.Axis edge="bottom" />
          <Chart.Tooltip />
          <Chart.Legend />
        </Chart.Root>
      </Box>
    </Surface>
  );
}
