import { useFormat, useT } from '@kroma/module-sdk';
import type { IconName } from '@kroma/ui/kit';
import { Box, Chart, Icon, Legend, Row, Surface, styles, Text } from '@kroma/ui/kit';
import { useMemo } from 'react';
import type { DownloadStatsView } from './schemas';
import { useLiveStats } from './use-live-stats';

const SERIES = { down: 'accent', up: 'success' } as const;

const GAP = 10;
const ZONE_GAP = 14;
const ZONE_MIN = 340;
const CELL_HEIGHT = 74;
const TILES_HEIGHT = CELL_HEIGHT * 2 + GAP;
const HEAD_HEIGHT = 18;
const HEAD_GAP = 8;
const PLOT_HEIGHT = TILES_HEIGHT - HEAD_HEIGHT - HEAD_GAP;

const WINDOW_SAMPLES = 36;
const SCALE_HEADROOM = 1.15;
const QUIET_CEILING_BPS = 128 * 1024;
const FLOOR_BELOW_ZERO = 0.06;

type StatTone = 'accent' | 'success' | 'text';

function shareRatioOf(stats: DownloadStatsView): string | null {
  if (stats.totalDownloadedBytes <= 0) return null;
  return (stats.totalUploadedBytes / stats.totalDownloadedBytes).toFixed(2);
}

function rateFormat(fmt: ReturnType<typeof useFormat>) {
  return (bytes: number) => `${fmt.bytes(bytes)}/s`;
}

export function DownloadStats({ stats: polled }: Readonly<{ stats: DownloadStatsView }>) {
  const stats = useLiveStats(polled);
  return (
    <Surface elevated radius="xl" border="border" pad="sm" mb={18}>
      <Row wrap align="stretch" gap={ZONE_GAP}>
        <StatTiles stats={stats} />
        <ThroughputChart stats={stats} />
      </Row>
    </Surface>
  );
}

function StatTiles({ stats }: Readonly<{ stats: DownloadStatsView }>) {
  const t = useT();
  const fmt = useFormat();
  const rate = rateFormat(fmt);

  const ratio = shareRatioOf(stats);
  const queued = (stats.byStatus.queued ?? 0) + (stats.byStatus.paused ?? 0);

  return (
    <Box flex minW={ZONE_MIN} gap={GAP}>
      <Row gap={GAP}>
        <StatTile
          icon="download"
          label={t('downloads.statDown')}
          value={rate(stats.downBps)}
          tone={SERIES.down}
          foot={t('downloads.totalDown', { total: fmt.bytes(stats.totalDownloadedBytes) })}
        />
        <StatTile
          icon="upload"
          label={t('downloads.statUp')}
          value={rate(stats.upBps)}
          tone={SERIES.up}
          foot={
            ratio
              ? t('downloads.totalUpRatio', {
                  total: fmt.bytes(stats.totalUploadedBytes),
                  ratio,
                })
              : t('downloads.totalUp', { total: fmt.bytes(stats.totalUploadedBytes) })
          }
        />
      </Row>
      <Row gap={GAP}>
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
      </Row>
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
  tone: StatTone;
  foot: string;
}>) {
  return (
    <Surface tone="raised" flex h={CELL_HEIGHT} px={12} pad="none" justify="center" gap={2}>
      <Row gap={6}>
        <Icon name={icon} size={12} thickness={2} color={tone === 'text' ? 'glyphDim' : tone} />
        <Text variant="overline" color="textDim" lines={1}>
          {label}
        </Text>
      </Row>
      <Text variant="cardTitle" color={tone} style={s.value} lines={1}>
        {value}
      </Text>
      <Text variant="meta" color="text/35" lines={1}>
        {foot}
      </Text>
    </Surface>
  );
}

function ThroughputChart({ stats }: Readonly<{ stats: DownloadStatsView }>) {
  const t = useT();
  const fmt = useFormat();
  const rate = rateFormat(fmt);

  const points = useMemo(
    () =>
      stats.history
        .slice(-WINDOW_SAMPLES)
        .map((sample) => ({ down: sample.downBps, up: sample.upBps })),
    [stats.history],
  );
  const peak = points.reduce((top, sample) => Math.max(top, sample.down, sample.up), 0);
  const ceiling = Math.max(peak * SCALE_HEADROOM, QUIET_CEILING_BPS);
  const floor = -ceiling * FLOOR_BELOW_ZERO;

  return (
    <Box flex minW={ZONE_MIN} gap={HEAD_GAP}>
      <Row between h={HEAD_HEIGHT}>
        <Text variant="overline" color="textDim" lines={1}>
          {t('downloads.throughput')}
        </Text>
        <Legend.Root>
          <Legend.Item color={SERIES.down}>{t('downloads.statDown')}</Legend.Item>
          <Legend.Item color={SERIES.up}>{t('downloads.statUp')}</Legend.Item>
        </Legend.Root>
      </Row>
      <Chart.Root
        data={points}
        height={PLOT_HEIGHT}
        min={floor}
        max={ceiling}
        format={rate}
        label={t('downloads.chartThroughput', {
          down: rate(stats.downBps),
          up: rate(stats.upBps),
        })}
      >
        <Chart.Grid ticks={4} />
        <Chart.Area series="down" label={t('downloads.statDown')} color={SERIES.down} />
        <Chart.Line series="up" label={t('downloads.statUp')} color={SERIES.up} />
        <Chart.Tooltip />
      </Chart.Root>
    </Box>
  );
}

const s = styles({ value: { fontVariant: ['tabular-nums'] } });
